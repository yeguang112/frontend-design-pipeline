// drift fixture: TSX 里的内联样式对象（camelCase 属性名也要能被识别）
import React from 'react';

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#1a1b20',        // hardcoded-color
        borderRadius: 10,             // off-scale-radius
        padding: 20,                  // off-scale-spacing
        fontSize: 18,                 // off-scale-font-size
        zIndex: 999,                  // magic-zindex
        boxShadow: '0 0 0 1px #ffffff22, 0 8px 24px #00000080, 0 2px 4px #00000040', // shadow-stack
      }}
    >
      {children}
    </div>
  );
}

// 合法写法：全部走 token
export function GoodCard({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}
