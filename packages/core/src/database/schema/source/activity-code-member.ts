import { relations } from 'drizzle-orm'
import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'

import { activityCodes } from './activity-codes.js'
import { users } from './users.js'

export const activityCodeMember = pgTable(
  'activity_code_member',
  {
    activity_code_id: uuid('activity_code_id')
      .notNull()
      .references(() => activityCodes.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { precision: 6, withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.activity_code_id, table.user_id],
    }),
  ]
)

export const activityCodeMemberRelations = relations(activityCodeMember, ({ one }) => ({
  activityCode: one(activityCodes, {
    fields: [activityCodeMember.activity_code_id],
    references: [activityCodes.id],
  }),
  user: one(users, {
    fields: [activityCodeMember.user_id],
    references: [users.id],
  }),
}))
