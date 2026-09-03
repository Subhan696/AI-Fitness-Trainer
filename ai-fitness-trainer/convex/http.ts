import { httpRouter } from "convex/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const http = httpRouter();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
    }

    const svix_id = request.headers.get("svix-id");
    const svix_signature = request.headers.get("svix-signature");
    const svix_timestamp = request.headers.get("svix-timestamp");

    if (!svix_id || !svix_signature || !svix_timestamp) {
      return new Response("No svix headers found", {
        status: 400,
      });
    }

    const payload = await request.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(webhookSecret);
    let evt: WebhookEvent;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return new Response("Error occurred", { status: 400 });
    }

    const eventType = evt.type;

    if (eventType === "user.created") {
      const { id, first_name, last_name, image_url, email_addresses } = evt.data;

      const email = email_addresses[0].email_address;

      const name = `${first_name || ""} ${last_name || ""}`.trim();

      try {
        await ctx.runMutation(api.users.syncUser, {
          email,
          name,
          image: image_url,
          clerkId: id,
        });
      } catch (error) {
        console.log("Error creating user:", error);
        return new Response("Error creating user", { status: 500 });
      }
    }

    if (eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url } = evt.data;

      const email = email_addresses[0].email_address;
      const name = `${first_name || ""} ${last_name || ""}`.trim();

      try {
        await ctx.runMutation(api.users.updateUser, {
          clerkId: id,
          email,
          name,
          image: image_url,
        });
      } catch (error) {
        console.log("Error updating user:", error);
        return new Response("Error updating user", { status: 500 });
      }
    }

    return new Response("Webhooks processed successfully", { status: 200 });
  }),
});

// validate and fix workout plan to ensure it has proper numeric types
function validateWorkoutPlan(plan: any) {
  const validatedPlan = {
    schedule: plan.schedule,
    exercises: plan.exercises.map((exercise: any) => ({
      day: exercise.day,
      routines: exercise.routines.map((routine: any) => ({
        name: routine.name,
        sets: typeof routine.sets === "number" ? routine.sets : parseInt(routine.sets) || 1,
        reps: typeof routine.reps === "number" ? routine.reps : parseInt(routine.reps) || 10,
      })),
    })),
  };
  return validatedPlan;
}

// validate diet plan to ensure it strictly follows schema
function validateDietPlan(plan: any) {
  // only keep the fields we want
  const validatedPlan = {
    dailyCalories: plan.dailyCalories,
    meals: plan.meals.map((meal: any) => ({
      name: meal.name,
      foods: meal.foods,
    })),
  };
  return validatedPlan;
}

async function generateWithGemini(prompt: string) {
  const candidateModels = [
    "gemini-3.6-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.5-flash",
    "gemini-3.5-pro",
  ];
  let lastError: any;

  for (const modelName of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            responseMimeType: "application/json",
          },
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        lastError = err;
        const is503 = err?.message?.includes("503") || err?.status === 503;
        if (is503 && attempt === 0) {
          console.log(`Model ${modelName} encountered 503 temporary demand spike, retrying in 600ms...`);
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }
        console.warn(`Model ${modelName} failed, trying next candidate:`, err?.message || err);
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini candidate models failed");
}

http.route({
  path: "/vapi/generate-program",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const payload = await request.json();
      console.log("Payload received:", JSON.stringify(payload, null, 2));

      // Handle both direct payloads and Vapi tool-calls payloads
      let args: any = payload;
      let toolCallId: string | undefined;

      if (payload.message?.toolCalls?.[0]?.function?.arguments) {
        toolCallId = payload.message.toolCalls[0].id;
        const rawArgs = payload.message.toolCalls[0].function.arguments;
        args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
      } else if (payload.message?.toolWithToolCallList?.[0]?.toolCall?.function?.arguments) {
        toolCallId = payload.message.toolWithToolCallList[0].toolCall.id;
        const rawArgs = payload.message.toolWithToolCallList[0].toolCall.function.arguments;
        args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
      }

      // Prioritize the actual Clerk user_id passed in Vapi variables over tool placeholder args
      const user_id =
        payload.message?.variableValues?.user_id ||
        payload.message?.artifact?.variableValues?.user_id ||
        payload.message?.call?.assistantOverrides?.variableValues?.user_id ||
        payload.user_id ||
        (args.user_id && args.user_id !== "user123" && !args.user_id.includes("{{") ? args.user_id : null);

      const {
        age = 25,
        height = "Not specified",
        weight = "Not specified",
        injuries = "None",
        workout_days = 4,
        fitness_goal = "General Fitness",
        fitness_level = "Intermediate",
        dietary_restrictions = "None",
      } = args;

      if (!user_id) {
        throw new Error("Missing user_id in payload or variables");
      }

      const combinedPrompt = `You are an experienced fitness and nutrition coach creating a personalized workout and diet plan based on:
      Age: ${age}
      Height: ${height}
      Weight: ${weight}
      Injuries or limitations: ${injuries}
      Available days for workout: ${workout_days}
      Fitness goal: ${fitness_goal}
      Fitness level: ${fitness_level}
      Dietary restrictions: ${dietary_restrictions}
      
      CRITICAL SCHEMA INSTRUCTIONS:
      - Return ONLY a valid JSON object with the exact keys "workoutPlan" and "dietPlan".
      - "sets" and "reps" MUST ALWAYS be NUMBERS, never strings (e.g. "sets": 3, "reps": 10).
      - "dailyCalories" MUST ALWAYS be a NUMBER, never a string (e.g. "dailyCalories": 2200).
      - Each meal must have ONLY "name" and "foods" array.
      - DO NOT add extra keys, notes, markdown formatting, or text outside the JSON.
      
      Return a JSON object with this EXACT structure:
      {
        "workoutPlan": {
          "schedule": ["Monday", "Tuesday", "Thursday", "Friday", "Saturday"],
          "exercises": [
            {
              "day": "Monday",
              "routines": [
                {
                  "name": "Bench Press",
                  "sets": 3,
                  "reps": 10
                }
              ]
            }
          ]
        },
        "dietPlan": {
          "dailyCalories": 2200,
          "meals": [
            {
              "name": "Breakfast",
              "foods": ["Oatmeal with berries", "Greek yogurt", "Black coffee"]
            },
            {
              "name": "Lunch",
              "foods": ["Grilled chicken salad", "Whole grain bread", "Water"]
            },
            {
              "name": "Dinner",
              "foods": ["Grilled salmon", "Steamed rice", "Broccoli"]
            }
          ]
        }
      }`;

      const generatedPlanText = await generateWithGemini(combinedPrompt);
      const generatedPlanJson = JSON.parse(generatedPlanText);

      // VALIDATE THE INPUT COMING FROM AI
      const workoutPlan = validateWorkoutPlan(generatedPlanJson.workoutPlan || generatedPlanJson);
      const dietPlan = validateDietPlan(generatedPlanJson.dietPlan || generatedPlanJson);

      // save to our DB: CONVEX
      const planId = await ctx.runMutation(api.plans.createPlan, {
        userId: user_id,
        dietPlan,
        isActive: true,
        workoutPlan,
        name: `${fitness_goal} Plan - ${new Date().toLocaleDateString()}`,
      });

      const responseBody = {
        success: true,
        data: {
          planId,
          workoutPlan,
          dietPlan,
        },
        // If Vapi expects tool results format
        results: toolCallId
          ? [
              {
                toolCallId,
                result: `Successfully generated workout and diet plan for ${fitness_goal}.`,
              },
            ]
          : undefined,
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error generating fitness plan:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;