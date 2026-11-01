// Deploy with --no-verify-jwt: this endpoint verifies an institution-held setup
// secret and permits exactly one bootstrap. Never expose that secret in Expo env.
import {createClient} from 'npm:@supabase/supabase-js@2.111.0';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL');const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const secret=Deno.env.get('NATIVE_ADMIN_SETUP_KEY');
 if(!url||!key||!secret||secret.length<20)return json({error:'Administrator initialization is unavailable'},503);
 const body=await request.json().catch(()=>null);
 if(typeof body?.setupCode!=='string'||body.setupCode!==secret)return json({error:'Invalid setup code'},403);
 if(typeof body.name!=='string'||!body.name.trim()||typeof body.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||typeof body.password!=='string'||body.password.length<12)return json({error:'Name, valid email and a password of at least 12 characters are required'},400);
 const sb=createClient(url,key,{auth:{persistSession:false}});
 const {count,error:countError}=await sb.from('profiles').select('id',{count:'exact',head:true}).eq('role','admin');
 if(countError)return json({error:'Initialization is unavailable'},503);if(count)return json({error:'An administrator already exists. Contact the institution.'},409);
 const {error:claim}=await sb.from('native_admin_bootstrap').insert({singleton:true});if(claim)return json({error:'Administrator setup has already been claimed'},409);
 let createdId:string|undefined;
 try{
 const {data,error}=await sb.auth.admin.createUser({email:body.email.trim(),password:body.password,email_confirm:true,user_metadata:{full_name:body.name.trim(),role:'admin'},app_metadata:{role:'admin'}});
 if(error||!data.user)throw new Error('Creation failed');createdId=data.user.id;
 const {error:profileError}=await sb.from('profiles').update({name:body.name.trim(),role:'admin'}).eq('id',createdId).select('id').single();if(profileError)throw profileError;
 return json({ok:true});
 }catch{
  if(createdId)await sb.auth.admin.deleteUser(createdId);
  await sb.from('native_admin_bootstrap').delete().eq('singleton',true);
  return json({error:'Administrator could not be initialized'},400);
 }
});
