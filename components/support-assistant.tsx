'use client';

import Link from 'next/link';
import { ArrowUp, BotMessageSquare, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type Faq = { id: string; question: string; answer: string; keywords: string[]; scope: string };
type Message = { role: 'user' | 'assistant'; text: string; risk?: boolean };
const risky = /withdraw|bank|upi|password|otp|fraud|security|refund|send money|payment|change.*account/i;

export function SupportAssistant({ faqs }: { faqs: Faq[] }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const starter = useMemo(() => faqs.slice(0, 3).map((faq) => faq.question), [faqs]);
  function ask(raw: string) {
    const text = raw.trim(); if (text.length < 4) return;
    const answer = risky.test(text) ? null : faqs.find((faq) => [faq.question, ...faq.keywords].join(' ').toLowerCase().split(/\W+/).filter((word) => word.length > 3).some((word) => text.toLowerCase().includes(word)));
    setMessages((all) => [...all, { role: 'user', text }, answer ? { role: 'assistant', text: answer.answer } : { role: 'assistant', risk: true, text: 'This needs a human review. For wallet, security, payment, account-change, or unclear cashback matters, I cannot guess or take action. Please open a support request and our team will review it.' }]);
    setQuestion('');
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); ask(question); }
  return <section className="chat-shell"><aside className="chat-rail"><div className="chat-brand"><Sparkles size={18}/><span><b>Ask Glonni</b><small>Customer support assistant</small></span></div><button type="button" onClick={() => setMessages([])}>＋ New chat</button><div className="chat-guard"><ShieldAlert size={17}/><p><b>Safe support boundary</b><span>Ask Glonni explains approved information. It cannot transfer money, change account details, or decide claims.</span></p></div><Link href="/support/requests"><ExternalLink size={15}/>Open a support request</Link></aside><div className="chat-main"><header><div><p>ASK GLONNI</p><h1>How can I help?</h1></div><span><i/>Approved answers only</span></header><div className={`chat-history ${messages.length ? 'has-messages' : ''}`}>{messages.length === 0 ? <div className="chat-welcome"><div className="chat-orb"><BotMessageSquare size={30}/></div><h2>Answers first. People when it matters.</h2><p>Ask about Glonni deals, stores, cashback, alerts, wallet history, or your account.</p><div>{starter.map((item) => <button type="button" key={item} onClick={() => ask(item)}>{item}</button>)}</div></div> : messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><div className="chat-avatar">{message.role === 'assistant' ? <BotMessageSquare size={16}/> : 'You'}</div><div><b>{message.role === 'assistant' ? 'Ask Glonni' : 'You'}</b><p>{message.text}</p>{message.risk && <Link href="/support/requests">Open a human support request <ExternalLink size={14}/></Link>}</div></article>)}</div><form className="chat-composer" onSubmit={submit}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Message Ask Glonni…" rows={1}/><button type="submit" aria-label="Send message"><ArrowUp size={18}/></button></form><small className="chat-footnote">Do not share passwords, OTPs, card details, or full bank details. For sensitive issues, open a support request.</small></div></section>;
}
