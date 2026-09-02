import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';

export function InfoPage({eyebrow,title,intro,children}:{eyebrow:string;title:string;intro:string;children:React.ReactNode}){return <><Header/><main className="info-page"><BrowseNav items={[{label:title}]}/><section className="info-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></section><section className="info-content">{children}</section></main></>}
