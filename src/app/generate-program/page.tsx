"use client"
import React, { use, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { vapi } from '@/lib/vapi';
import { Card } from '@/components/ui/card';
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
      <div className='container mx-auto px-4 h-full max-w-5xl'>
        {/*Title */}
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-black font-mono'>
            <span>Generate Your</span>
            <span className='text-primary uppercase'> Fitness Program</span> 
          </h1>
<p className='text-muted-foreground mt-2'>
  Have a vocal Conversaton with our AI Assistant to create your personalized plan
</p>
        </div>

        {/* Video call area*/}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
          {/*AI assistant card */}
          <Card className='bg-card/90 backdrop-blur-sm border-border overflow-hidden relative'>
          <div className='aspect-video flex flex-col items-center justify-center p-6 relative'>
            {/*AI Voice Animation */}
             <div
                className={`absolute inset-0 ${
                  isSpeaking ? "opacity-30" : "opacity-0"
                } transition-opacity duration-300`}
              >
                {/* Voice wave animation when speaking */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-center items-center h-20">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`mx-1 h-16 w-1 bg-primary rounded-full ${
                        isSpeaking ? "animate-sound-wave" : ""
                      }`}
                      style={{
                        animationDelay: `${i * 0.1}s`,
                        height: isSpeaking ? `${Math.random() * 50 + 20}%` : "5%",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* AI IMAGE */}
              <div className="relative size-32 mb-4">
                <div
                  className={`absolute inset-0 bg-primary opacity-10 rounded-full blur-lg ${
                    isSpeaking ? "animate-pulse" : ""
                  }`}
                />

                <div className="relative w-full h-full rounded-full bg-card flex items-center justify-center border border-border overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-secondary/10"></div>
                  <img
                    src="/ai-avatar.png"
                    alt="AI Assistant"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <h2 className="text-xl font-bold text-foreground">CodeFlex AI</h2>
              <p className="text-sm text-muted-foreground mt-1">Fitness & Diet Coach</p>

              {/* SPEAKING INDICATOR */}

              <div
                className={`mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border ${
                  isSpeaking ? "border-primary" : ""
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isSpeaking ? "bg-primary animate-pulse" : "bg-muted"
                  }`}
                />

                <span className="text-xs text-muted-foreground">
                  {isSpeaking
                    ? "Speaking..."
                    : callActive
                      ? "Listening..."
                      : callEnded
                        ? "Redirecting to profile..."
                        : "Waiting..."}
                </span>
              </div>

            </div>
            </Card>
            
        </div>
        </div>
        </div>

      
      
      )
}

export default GenerateProgramPage;
