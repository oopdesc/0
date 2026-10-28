import { useState } from "react";
import Track from "./problems/TrackPage";
import Review from "./problems/ReviewPage";
export default function CuratedProblems({ initialLanguage = "java" }: { initialLanguage?: "java" | "rust" }) {
const [tab,setTab]=useState<string>(initialLanguage);
return <div><div className="hub-practice-controls" role="group" aria-label="演習の言語">{[["java","Java"],["rust","Rust"],["bridge","言語の比較"],["review","今日の復習"]].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>{tab==="review"?<Review onNavigate={()=>setTab("java")} />:<Track key={tab} language={tab as "java"|"rust"|"bridge"} onNavigate={href=>setTab(href==="/review"?"review":"java")}/>}</div>;
}
