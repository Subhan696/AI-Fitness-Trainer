import { httpActionGeneric, httpRouter, HttpRouter } from "convex/server";
import {WebhookEvent} from "@clerk/nextjs/server";
import {Webhook} from "svix";
import  {api} from "./_generated/api";
import { httpAction } from "./_generated/server";



const http=httpRouter();

http.route({
path: "/clerk-webhook",
method: "POST",
handler:httpAction(async(ctx,request)=>{
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!;
    if (!webhookSecret) {
        throw new Error("CLERK_WEBHOOK_SECRET is not set");
    }
    const svix_id=request.headers.get("svix-id");
    const svix_timestamp=request.headers.get("svix-timestamp");
    const svix_signature=request.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
        throw new Error("Missing svix headers");
    }
    const payload = await request.json();
    const body = JSON.stringify(payload);

    const wh=new Webhook(webhookSecret);
    let evt: WebhookEvent;

    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        })as WebhookEvent;

    } catch (error) {
        console.error("Webhook verification failed:", error);
        throw new Error("Invalid webhook signature");
    }
    const eventType= evt.type;
    if (eventType === "user.created") {
        const {id,first_name,last_name,image_url,email_addresses} = evt.data;
        const email=email_addresses[0].email_address;
        const name = `${first_name|| ""} ${last_name||""}`.trim();

        try{
            await ctx.runMutation(api.users.syncUser, {
                email,
                name,
                image: image_url || "",
                clerkId: id,
        })
    }catch (error) {
        console.error("Error syncing user:", error);
    }

        // Handle user creation logic here, e.g., create a user record in your database
        
    }
    if(eventType==="user.created"){

    }
    return new Response("Webhook received", { status: 200 });
})

})
export default http;


