'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="customer-state-page" role="alert"><b>!</b><h1>This page could not be loaded</h1><p>Your account data has not been changed. Try loading the page again.</p><div><button onClick={reset}>Try again</button><a href="/">Go to homepage</a></div></main>;}
