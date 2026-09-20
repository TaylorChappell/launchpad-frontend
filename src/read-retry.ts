// Retry only idempotent reads and only transient transport/provider failures.
export async function readWithRetry<T>(read:()=>Promise<T>,signal:AbortSignal):Promise<T>{
  try{return await read();}catch(error){
    const status=error&&typeof error==="object"&&"status" in error?Number(error.status):0;
    if(signal.aborted||!(error instanceof TypeError||[502,503,504].includes(status)))throw error;
    await new Promise<void>((resolve,reject)=>{
      const cancel=()=>{clearTimeout(timer);reject(signal.reason);};
      const timer=setTimeout(()=>{signal.removeEventListener("abort",cancel);resolve();},400);
      signal.addEventListener("abort",cancel,{once:true});
      if(signal.aborted)cancel();
    });
    return read();
  }
}
