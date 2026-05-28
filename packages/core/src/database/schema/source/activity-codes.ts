import { relations } from 'drizzle-orm'
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'

import { timestamps } from '../common.js'
import { activityCodeMember } from './activity-code-member.js'
import { enrollment } from './enrollment.js'
import { users } from './users.js'

export const activityCodes = pgTable('activity_codes', {
  id: uuid('id').primaryKey().notNull(),
  created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  code: varchar('code', { length: 255 }).notNull().unique(),
  private_code: varchar('private_code', { length: 255 }).notNull().unique(),
  url_prefix: varchar('url_prefix', { length: 255 }),
  ...timestamps,
})

export const activityCodesRelations = relations(activityCodes, ({ one, many }) => ({
  creator: one(users, {
    fields: [activityCodes.created_by],
    references: [users.id],
  }),
  members: many(activityCodeMember),
  enrollment: many(enrollment),
}))
