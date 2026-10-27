import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
interface Props { completed: number; total: number; due: number; storageAvailable: boolean }
export function Header({ completed, total, due, storageAvailable }: Props) {
  const [open, setOpen] = useState(false);
  const links = [{ href: '#missions', text: 'ミッション' }, { href: '#lab', text: '実験室' }, { href: '#atlas', text: '概念の地図' }, { href: '#review', text: `復習${due ? ` ${due}` : ''}` }];
  return <>
    <a className="skip-link" href="#main">本文へスキップ</a>
    <header className="site-header">
      <a href="#top" className="brand" aria-label="ORBIT トップへ"><span className="brand-mark"><span /></span><span className="brand-word">ORBIT<small>CODE & COSMOS</small></span></a>
      <nav aria-label="メインナビゲーション" className={`main-nav ${open ? 'is-open' : ''}`}>
        {links.map((link) => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.text}</a>)}
      </nav>
      <div className="header-right"><div className="local-status"><span className="status-dot" /> <span>{storageAvailable ? '記録はこの端末に' : '保存不可'}</span> <b>{String(completed).padStart(2, '0')} / {String(total).padStart(2, '0')}</b></div><a href="#lab" className="header-cta">実験をはじめる <ArrowUpRight size={14} /></a></div>
      <button type="button" className="menu-toggle" aria-label={open ? 'メニューを閉じる' : 'メニューを開く'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </header>
  </>;
}
