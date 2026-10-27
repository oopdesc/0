import { useRef, useState, type UIEvent } from 'react';
import { Copy, RotateCcw, Check } from 'lucide-react';
import type { Language } from '../domain/types';

const keywords = new Set(['int', 'long', 'for', 'let', 'match', 'Some', 'None', 'usize', 'true', 'false', 'List', 'Integer']);
function highlight(code: string) {
  const parts = code.split(/("[^"\n]*"|\b(?:int|long|for|let|match|Some|None|usize|true|false|List|Integer)\b|\b\d+\b|\/\/[^\n]*)/g);
  return parts.map((part, i) => {
    let name = '';
    if (keywords.has(part)) name = 'syntax-keyword'; else if (/^"/.test(part)) name = 'syntax-string'; else if (/^\d+$/.test(part)) name = 'syntax-number'; else if (part.startsWith('//')) name = 'syntax-comment';
    return name ? <span className={name} key={i}>{part}</span> : part;
  });
}
interface Props { language: Language; value: string; onChange: (value: string) => void; onReset: () => void; id?: string }
export function CodeEditor({ language, value, onChange, onReset, id = 'code-editor' }: Props) {
  const highlightRef = useRef<HTMLPreElement>(null); const linesRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const lines = Math.max(8, value.split('\n').length);
  const sync = (e: UIEvent<HTMLTextAreaElement>) => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } if (linesRef.current) linesRef.current.scrollTop = e.currentTarget.scrollTop; };
  const copy = async () => { try { if (!navigator.clipboard) throw new Error('unavailable'); await navigator.clipboard.writeText(value); setCopyState('done'); } catch { setCopyState('error'); } window.setTimeout(() => setCopyState('idle'), 2500); };
  return <div className="editor">
    <div className="editor-bar"><span><span className="editor-file-dot" /> {language === 'Java' ? 'OrbitLab.java' : 'orbit_lab.rs'} <small> / 編集可能</small></span><div><button type="button" onClick={copy} disabled={!value} aria-label="コードをコピー" title="コードをコピー">{copyState === 'done' ? <Check size={14} /> : <Copy size={14} />}</button><button type="button" onClick={onReset} aria-label="この段階のコードをリセット" title="この段階のコードをリセット"><RotateCcw size={14} /></button></div></div>
    <div className="editor-input">
      <div className="line-numbers" aria-hidden="true" ref={linesRef}>{Array.from({ length: lines }, (_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div>
      <div className="code-layers"><pre aria-hidden="true" className="code-highlight" ref={highlightRef}><code>{highlight(value)}{'\n'}</code></pre><textarea id={id} aria-label={`${language}のコード`} spellCheck={false} autoCapitalize="off" autoCorrect="off" value={value} maxLength={3000} onChange={(e) => onChange(e.target.value)} onScroll={sync} placeholder="ここにコードを入力" /></div>
    </div>
    <div className="editor-foot"><span>UTF-8 <b>·</b> {language.toUpperCase()} SUBSET</span><span aria-live="polite">{copyState === 'done' ? 'コピーしました' : copyState === 'error' ? 'コピー不可。テキストを選択してください' : `${value.length} / 3000`}</span></div>
  </div>;
}
