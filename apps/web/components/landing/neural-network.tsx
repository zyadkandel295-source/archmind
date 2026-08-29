"use client";

/** Presentation-only structural backdrop retained behind the existing landing content. */
export function NeuralNetworkBackground() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-[#EFE3D2]"><div className="absolute -right-36 -top-36 h-[36rem] w-[36rem] rounded-full border border-[#E5C895]/35" /><div className="absolute -right-20 -top-20 h-[22rem] w-[22rem] rounded-full border border-[#D9A960]/25" /><div className="absolute bottom-16 left-[10%] h-px w-40 bg-[#D8B583]/35" /><div className="absolute bottom-16 left-[10%] h-10 w-px bg-[#D8B583]/35" /></div>;
}
