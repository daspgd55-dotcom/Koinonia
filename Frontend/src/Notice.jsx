import React from 'react';
export default function Notice({ children, error = false }) { return children ? <div className={'notice ' + (error ? 'error' : '')} role={error ? 'alert' : 'status'}>{children}</div> : null; }
