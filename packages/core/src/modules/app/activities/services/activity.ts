import * as crypto from 'node:crypto'

import { adjectives, animals, uniqueNamesGenerator } from 'unique-names-generator'
import { v7 as uuidv7 } from 'uuid'

import { BaseService, method } from '@/lib/base-service.js'
import {
  ERR_ACTIVITY_CODE_GENERATION,
  ERR_ACTIVITY_CODE_NOT_FOUND,
  ERR_USER_NOT_INSTRUCTOR,
} from '../errors.js'
import {
  type ActivityCode,
  type ActivityCodeMember,
  type ActivityCodeWithActivities,
  type AddActivityCodeMemberRequest,
  type CreateActivityCodeRequest,
  type InstructorSearchResult,
  type ProgressReport,
  type ProgressRequest,
  type RemoveActivityCodeMemberRequest,
  type SearchInstructorsRequest,
  toActivity,
  toActivityCode,
  type UpdateActivityCodeRequest,
} from '../schemas.js'
import type { UserAuth } from '@/lib/auth.js'
import type { TXManager } from '@/lib/db-manager.js'
import type { CoreLogger } from '@/lib/logger.js'
import type { ActivityMutations, ActivityQueries } from '../repository/index.js'

export class ActivityService extends BaseService {
  private tx: TXManager
  private queries: ActivityQueries
  private mutations: ActivityMutations

  constructor(deps: {
    logger: CoreLogger
    tx: TXManager
    queries: ActivityQueries
    mutations: ActivityMutations
  }) {
    super(deps.logger, 'app', 'activities')
    this.tx = deps.tx
    this.queries = deps.queries
    this.mutations = deps.mutations
  }

  @method
  async listActivityCodes(userAuth: UserAuth): Promise<ActivityCode[]> {
    const records = await this.queries.listActivityCodesByMember(userAuth.id)
    return records.map(toActivityCode)
  }

  /**
   * Loads an activity code only if the caller is a member of it. Treated as
   * a 404 (ERR_ACTIVITY_CODE_NOT_FOUND) when the caller is not a member, so
   * we don't leak the existence of codes that belong to other instructors.
   */
  private async loadAsMember(
    userAuth: UserAuth,
    id: string
  ): Promise<{
    record: NonNullable<Awaited<ReturnType<ActivityQueries['findActivityCodeById']>>>
  }> {
    const record = await this.queries.findActivityCodeById(id)
    if (record == null) {
      throw ERR_ACTIVITY_CODE_NOT_FOUND({
        message: 'activity code not found',
      }).log(this.logger)
    }
    const member = await this.queries.isMember(id, userAuth.id)
    if (!member) {
      throw ERR_ACTIVITY_CODE_NOT_FOUND({
        message: 'activity code not found for user',
      }).log(this.logger)
    }
    return { record }
  }

  @method
  async getActivityCode(userAuth: UserAuth, id: string): Promise<ActivityCode> {
    const { record } = await this.loadAsMember(userAuth, id)
    return toActivityCode(record)
  }

  @method
  async getActivitiesByActivityCodeId(
    userAuth: UserAuth,
    id: string
  ): Promise<ActivityCodeWithActivities> {
    const { record: activityCodeRecord } = await this.loadAsMember(userAuth, id)

    const activityRecords = await this.queries.listActivitiesByActivityCodeId(activityCodeRecord.id)

    return {
      activity_code: toActivityCode(activityCodeRecord),
      activities: activityRecords.map(toActivity),
    }
  }

  @method
  async getProgress(userAuth: UserAuth, request: ProgressRequest): Promise<ProgressReport> {
    const { record: activityCodeRecord } = await this.loadAsMember(userAuth, request.id)

    const { page, page_size, query, order, desc } = request.options

    const results = await this.queries.getActivityCodeProgress(
      activityCodeRecord.id,
      request.options
    )

    // Extract total progress items from the first row (if any)
    const total = results[0]?.total ?? 0

    return {
      progress: results.map(
        ({
          user_id,
          full_name,
          activity_code,
          activity_code_id,
          progress,
          activity_name,
          activity_url,
          created_at,
          updated_at,
        }) => ({
          user_id,
          full_name,
          activity_code,
          activity_code_id,
          progress,
          activity_name,
          activity_url,
          created_at: created_at?.toISOString() ?? null,
          updated_at: updated_at?.toISOString() ?? null,
        })
      ),
      included: {
        activity_code: toActivityCode(activityCodeRecord),
      },
      meta: {
        total,
        page,
        page_size,
        total_pages: Math.ceil(total / page_size),
        query,
        order,
        desc,
      },
    }
  }

  /**
   * Generates a random two-word activity code, and checks that it hasn't been
   * used already.
   */
  @method
  async generateUniqueActivityCode(_userAuth: UserAuth): Promise<string> {
    const maxAttempts = 20
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      const code = uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: '-',
        length: 2,
      })

      const preexistingCode = await this.queries.findActivityCodeByPublicCode(code)
      if (preexistingCode == null) {
        return code
      }
    }

    throw ERR_ACTIVITY_CODE_GENERATION({
      message: `failed to generate a unique code after ${maxAttempts} attempts`,
    }).log(this.logger)
  }

  @method
  async createActivityCode(
    userAuth: UserAuth,
    request: CreateActivityCodeRequest
  ): Promise<ActivityCode> {
    return this.tx.withTransaction(async () => {
      const private_code = crypto.randomBytes(8).toString('hex')

      const activityCodeRecord = await this.mutations.createActivityCode({
        id: uuidv7(),
        code: request.code,
        private_code,
        url_prefix: request.url_prefix ?? null,
        created_by: userAuth.id,
      })

      // Creator is automatically the first member.
      await this.mutations.addMember(activityCodeRecord.id, userAuth.id)

      await this.mutations.ensureActivitiesExist(request.urls)
      const activityRecords = await this.queries.findActivitiesByURL(request.urls)
      await this.mutations.assignActivitiesToActivityCode(activityCodeRecord, activityRecords)

      return toActivityCode(activityCodeRecord)
    })
  }

  @method
  async updateActivityCode(
    userAuth: UserAuth,
    { id, url_prefix, urls }: UpdateActivityCodeRequest
  ): Promise<ActivityCode> {
    // TODO: Validate urls, here and in createActivityCode
    // const urlValidationResult = validateUrls(urls)
    // if (urlValidationResult.valid === false) {
    //   throw new ERR_INVALID_ACTIVITY_URL(urlValidationResult.message)
    // }

    // 1. Check that the caller is a member of the activity code.
    const { record: activityCodeRecord } = await this.loadAsMember(userAuth, id)

    // 2. We'll clear/delete all existing activityActivityCode joins for this activity code
    // so that we can re-create them with the new URLs.
    // TODO: NOTE! This does not solve the issue of activities (and URLs) that
    // are not longer being used, whether by this activity code, other activity codes,
    // or activity URLs that may have been created by users that attempted activities
    // that are allowed, but not associated with any activity code.
    return this.tx.withTransaction(async () => {
      const updatedActivityCodeRecord = await this.mutations.updateActivityCode(id, {
        url_prefix: url_prefix ?? null,
      })

      // Insert the activity URLs into the activities table
      // with onConflictDoNothing - i.e. only new URLs will be inserted
      await this.mutations.ensureActivitiesExist(urls)

      await this.mutations.removeActivitiesFromActivityCode(activityCodeRecord)
      const activityRecords = await this.queries.findActivitiesByURL(urls)
      await this.mutations.assignActivitiesToActivityCode(activityCodeRecord, activityRecords)

      return toActivityCode(updatedActivityCodeRecord)
    })
  }

  @method
  async deleteActivityCode(userAuth: UserAuth, id: string): Promise<void> {
    await this.loadAsMember(userAuth, id)
    await this.mutations.deleteActivityCode(id)
  }

  @method
  async listActivityCodeMembers(
    userAuth: UserAuth,
    activity_code_id: string
  ): Promise<ActivityCodeMember[]> {
    await this.loadAsMember(userAuth, activity_code_id)
    return await this.queries.listMembers(activity_code_id)
  }

  @method
  async searchInstructors(
    userAuth: UserAuth,
    { activity_code_id, query, limit }: SearchInstructorsRequest
  ): Promise<InstructorSearchResult[]> {
    await this.loadAsMember(userAuth, activity_code_id)
    return await this.queries.searchInstructors(activity_code_id, query, limit)
  }

  @method
  async addActivityCodeMember(
    userAuth: UserAuth,
    { activity_code_id, user_id }: AddActivityCodeMemberRequest
  ): Promise<ActivityCodeMember[]> {
    await this.loadAsMember(userAuth, activity_code_id)
    const isInstructor = await this.queries.isInstructor(user_id)
    if (!isInstructor) {
      throw ERR_USER_NOT_INSTRUCTOR({
        message: 'target user is not an instructor',
      }).log(this.logger)
    }
    await this.mutations.addMember(activity_code_id, user_id)
    return await this.queries.listMembers(activity_code_id)
  }

  @method
  async removeActivityCodeMember(
    userAuth: UserAuth,
    { activity_code_id, user_id }: RemoveActivityCodeMemberRequest
  ): Promise<ActivityCodeMember[]> {
    await this.loadAsMember(userAuth, activity_code_id)
    await this.mutations.removeMember(activity_code_id, user_id)
    return await this.queries.listMembers(activity_code_id)
  }
}
