'use server';
import { redirect } from 'next/navigation'; import { createClient } from '@/lib/supabase/server';
export async function signIn(formData:FormData){const supabase=await createClient();const {error}=await supabase.auth.signInWithPassword({email:String(formData.get('email')),password:String(formData.get('password'))});if(error)redirect('/login?error=invalid');redirect('/account');}
export async function signUp(formData:FormData){const supabase=await createClient();const email=String(formData.get('email'));const password=String(formData.get('password'));const {data,error}=await supabase.auth.signUp({email,password});if(error)redirect('/login?error=signup');if(data.session)redirect('/account');redirect('/login?checkEmail=1');}
