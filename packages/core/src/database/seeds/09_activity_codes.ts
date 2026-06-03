import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { v7 as uuidv7 } from 'uuid'

import { activityCodeMember } from '../schema/source/activity-code-member.js'
import { activityCodes } from '../schema/source/activity-codes.js'
import type * as schema from '../schema/index.js'

export const seedActivityCodes = async (
  db: NodePgDatabase<typeof schema>,
  userIds: { id: string }[]
) => {
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Activity Code data
  const activityCodeData: (typeof activityCodes.$inferInsert)[] = [
    {
      id: uuidv7(),
      created_by: userIds[0]!.id,
      code: 'eager-jellyfish',
      private_code: '98fj98jloawifj',
    },
    {
      id: uuidv7(),
      created_by: userIds[0]!.id,
      code: 'successive-lamprey',
      private_code: 'fejwaoifoeweif',
    },
    {
      id: uuidv7(),
      created_by: userIds[2]!.id,
      code: 'elderly-mockingbird',
      private_code: 'ofjwiejf23fa9w',
    },
    {
      id: uuidv7(),
      created_by: userIds[3]!.id,
      code: 'tasteless-whippet',
      private_code: 'f389fj98f23382',
    },
  ]

  console.log('Seed activity_codes start')
  const activityCodeIds = await db
    .insert(activityCodes)
    .values(activityCodeData)
    .returning({ id: activityCodes.id })

  // Seed initial membership rows so each creator is a member of their code.
  const memberRows = activityCodeData
    .filter((row) => row.created_by != null)
    .map((row, idx) => ({
      activity_code_id: activityCodeIds[idx]!.id,
      user_id: row.created_by as string,
    }))
  if (memberRows.length > 0) {
    await db.insert(activityCodeMember).values(memberRows).onConflictDoNothing()
  }
  console.log('Seed activity_codes done')

  return activityCodeIds
}
