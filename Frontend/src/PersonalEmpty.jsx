import React from 'react';
import './PersonalPages.css';
export default function PersonalEmpty({title,children,href,action,onAction}){return <section className="personal-empty"><h2>{title}</h2>{children&&<p>{children}</p>}{href&&<a className="secondary" href={href}>{action}</a>}{onAction&&<button className="secondary" onClick={onAction}>{action}</button>}</section>;}
