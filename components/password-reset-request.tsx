'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function PasswordResetRequest(){const [message,setMessage]=useState('');async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);const email=String(form.get('email'));const supabase=createClient();const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/auth/callback?next=/reset-password`});setMessage(error?'Please wait a minute, then try again.':'Check your email for the secure password-reset link.');}return <form onSubmit={submit}><label>Email<input name="email" type="email" required placeholder="admin@glonni.com"/></label><button className="text-action">Forgot password?</button>{message&&<small className="reset-message">{message}</small>}</form>}
