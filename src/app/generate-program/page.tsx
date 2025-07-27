"use client"
import React, { use, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { vapi } from '@/lib/vapi';
// Removed incorrect setTimeout import; use the global setTimeout instead.

const GenerateProgramPage = () => {
  const[callActive,setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const[isSpeaking, setIsSpeaking] = useState(false);
  const[messages, setMessages] = useState<any[]>([]);
  const[callEnded, setCallEnded] = useState(false);

  const {user}=useUser();
  const router = useRouter();

  const messageContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() =>
    {
      if(callEnded){
        const redirectTimer=setTimeout(() => {
          router.push("/profile");
        },1500);
    return () => 
      clearTimeout(redirectTimer);
}},[callEnded, router]);

useEffect(() =>
   {
    if(messageContainerRef.current){
        messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
      }

   },[messages]);

   useEffect(() => {
    const handleCallStart = () => {
      console.log("Call started");
      setCallActive(true);
      setConnecting(false);
      setCallEnded(false);
      
    }
    const handleCallEnd = () => {
      console.log("Call ended");
      setCallActive(false);
      setConnecting(false);
      setIsSpeaking(false);
      setCallEnded(true);
    }
    const handelSpeechStart = () => {
      console.log("AI started Speaking");
      setIsSpeaking(true);
    }
    const handleSpeechEnd = () => {
      console.log("AI stopped Speaking");
      setIsSpeaking(false);
    }
    const handleMessage = (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
      const newMessage={content: message.transcript, role: message.role};
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      }
    }


    const handleError = (error: any) => {
      console.error("Vapi Error:", error);
      setConnecting(false);
      setCallActive(false);
      
    }

    vapi.on("call-start", handleCallStart);
    vapi.on("call-end", handleCallEnd);
    vapi.on("speech-start", handelSpeechStart);
    vapi.on("speech-end", handleSpeechEnd);
    vapi.on("message", handleMessage);
    vapi.on("error", handleError);

    return () => {
      vapi.off("call-start", handleCallStart);
      vapi.off("call-end", handleCallEnd);
      vapi.off("speech-start", handelSpeechStart);
      vapi.off("speech-end", handleSpeechEnd);
      vapi.off("message", handleMessage);
      vapi.off("error", handleError);
    };
   },[]);

   const toggleCall = async () => {
    if(callActive) vapi.stop();
    else {
      try
      {
        setConnecting(true);
        setMessages([]);
        setCallEnded(false);

        const fullName = user?.fullName ?'${user.firstName} ${user.lastName} || ""}'.trim() : "There";
        await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
          variableValues:{user_id: user?.id,
          full_name: fullName,
          },
        });
      }catch(error) {
        console.error("Error starting Vapi call:", error);
        setConnecting(false);
      }
    }
  };

  return (
    <div className='flex flex-cool min-h-screen text-foreground overflow-hidden pb-6 pt-24'>
      
      
      </div>
      )
}

export default GenerateProgramPage;
