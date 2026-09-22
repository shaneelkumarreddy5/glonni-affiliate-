'use client';

import Link from 'next/link';
import { ArrowUp, BotMessageSquare, ExternalLink, ShieldAlert } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { escalateAssistantQuestion } from '@/app/support/actions';

type Faq = { id: string; question: string; answer: string; keywords: string[]; scope: string };
type Message = { role: 'user' | 'assistant'; text: string; risk?: boolean; question?: string };
const risky = /withdraw|bank|upi|password|otp|fraud|security|refund|send money|payment|change.*account/i;

export function SupportAssistant({ faqs }: { faqs: Faq[] }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const starter = useMemo(() => faqs.slice(0, 3).map((faq) => faq.question), [faqs]);
  function ask(raw: string) {
    const text = raw.trim(); if (text.length < 4) return;
    const answer = risky.test(text) ? null : faqs.find((faq) => [faq.question, ...faq.keywords].join(' ').toLowerCase().split(/\W+/).filter((word) => word.length > 3).some((word) => text.toLowerCase().includes(word)));
    setMessages((all) => [...all, { role: 'user', text }, answer ? { role: 'assistant', text: answer.answer } : { role: 'assistant', risk: true, question: text, text: 'This needs human review. I cannot guess about wallet, security, payment, account changes, or unclear cashback matters. I can open a tracked request for the support team with this conversation attached.' }]);
    setQuestion('');
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); ask(question); }
  return <section className="chat-shell"><div className="chat-main"><header><div><p>ASK GLONNI</p><h1>How can I help?</h1></div><div className="chat-header-actions"><button type="button" onClick={() => setMessages([])}>＋ New chat</button><span><i/>Approved answers only</span></div></header><div className={`chat-history ${messages.length ? 'has-messages' : ''}`}>{messages.length === 0 ? <div className="chat-welcome"><div className="chat-orb"><BotMessageSquare size={30}/></div><h2>Answers first. People when it matters.</h2><p>Ask about Glonni deals, stores, cashback, alerts, wallet history, or your account.</p><div className="chat-suggestions">{starter.map((item) => <button type="button" key={item} onClick={() => ask(item)}>{item}</button>)}<Link href="/support/requests">Open a support request <ExternalLink size={13}/></Link></div><div className="chat-safe-note"><ShieldAlert size={16}/><span>Never share passwords, OTPs, card details, or full bank details.</span></div></div> : messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><div className="chat-avatar">{message.role === 'assistant' ? <BotMessageSquare size={16}/> : 'You'}</div><div><b>{message.role === 'assistant' ? 'Ask Glonni' : 'You'}</b><p>{message.text}</p>{message.risk && message.question && <form action={escalateAssistantQuestion}><input type="hidden" name="question" value={message.question}/><button className="chat-escalate" type="submit">Open tracked human review <ExternalLink size={14}/></button></form>}</div></article>)}</div><form className="chat-composer" onSubmit={submit}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Message Ask Glonni…" rows={1}/><button type="submit" aria-label="Send message"><ArrowUp size={18}/></button></form><small className="chat-footnote">Ask Glonni uses approved Glonni answers. Sensitive or uncertain issues are sent to the support team for review.</small></div></section>;
}
