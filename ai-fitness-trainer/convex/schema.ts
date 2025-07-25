import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    clerkId: v.string(),
  }).index("byClerkId", ["clerkId"]),

  plans: defineTable({
    userId:v.id("users"),
    name: v.string(),
    workoutPlan:v.object({
      schedule:v.array(v.string()),
      exercises:v.array(v.object({
        day: v.string(),
        routines: v.array(v.object({
          name: v.string(),
          sets:v.optional(v.number()),
          reps:v.optional(v.number()),
          duration:v.optional(v.string()),
          description:v.optional(v.string()),
          exercises:v.optional(v.array(v.string())),
        })
      ),
    })
  ),
}),
dietPlan:v.object({
  dailyCalories:v.number(),
  meals:v.array(
    v.object({
      name: v.string(),
      foods:v.array(v.string()),
    })
  ),
}),
isActive:v.boolean(),


    })
    .index("by_user_id", ["userId"])
    .index("by_active",["isActive"]),

});
