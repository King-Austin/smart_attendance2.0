// Deploy as Supabase Edge Function native-session-push, with JWT verification enabled.
import {createClient} from 'npm:@supabase/supabase-js@2.111.0';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return json({error:'Push delivery is not configured'},503);
 const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Unauthorized'},401);
 const sb=createClient(url,key,{auth:{persistSession:false}});
 const {data:identity,error:authError}=await sb.auth.getUser(token);if(authError||!identity.user)return json({error:'Unauthorized'},401);
 const body=await request.json().catch(()=>null);if(typeof body?.sessionId!=='string')return json({error:'Session ID required'},400);
 const {data:session,error:sessionError}=await sb.from('attendance_sessions').select('id,course_id,topic,lecturer_id,status,created_at').eq('id',body.sessionId).single();
 if(sessionError||!session)return json({error:'Session not found'},404);
 if(session.lecturer_id!==identity.user.id)return json({error:'Forbidden'},403);
 if(session.status!=='active'||Date.now()-Date.parse(session.created_at)>30*60*1000)return json({error:'Session is not active'},409);
 const {data:profile}=await sb.from('profiles').select('role,approval_status').eq('id',identity.user.id).single();
 if(profile?.role!=='lecturer'||profile.approval_status!=='approved')return json({error:'Approved lecturer required'},403);
 // Claim once per session. Prevent repeated client requests from spamming students.
 const {error:claim}=await sb.from('native_push_dispatches').insert({session_id:session.id});
 if(claim?.code==='23505')return json({ok:true,alreadyRequested:true});if(claim)return json({error:'Could not claim dispatch'},503);
 try{
 const {data:students,error:studentError}=await sb.from('profiles').select('id').eq('role','student').contains('course_ids',[session.course_id]).in('notification_channel',['push','both']);
 if(studentError)throw studentError;
 let sent=0;const ids=(students??[]).map(row=>row.id);
 for(let offset=0;offset<ids.length;offset+=200){
  const {data:registrations,error}=await sb.from('native_push_tokens').select('token').in('user_id',ids.slice(offset,offset+200));if(error)throw error;
  const tokens=(registrations??[]).filter(row=>/^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(row.token));
  for(let at=0;at<tokens.length;at+=100){
   const batch=tokens.slice(at,at+100);const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(Deno.env.get('EXPO_ACCESS_TOKEN')?{Authorization:`Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`}:{})},body:JSON.stringify(batch.map(row=>({to:row.token,title:'Attendance is open',body:session.topic,channelId:'attendance',data:{sessionId:session.id}}))),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('Push provider unavailable');const result=await response.json();if(!Array.isArray(result.data))throw new Error('Invalid push provider response');
   for(let i=0;i<result.data.length;i++){const ticket=result.data[i];if(ticket.status==='ok')sent++;else if(ticket.details?.error==='DeviceNotRegistered')await sb.from('native_push_tokens').delete().eq('token',batch[i].token)}
  }
 }
 await sb.from('native_push_dispatches').update({completed_at:new Date().toISOString(),sent_count:sent}).eq('session_id',session.id);
 return json({ok:true,acceptedByProvider:sent});
 }catch{return json({error:'Push delivery did not complete. Inspect server dispatch logs before retrying; session remains active.'},502)}
});
