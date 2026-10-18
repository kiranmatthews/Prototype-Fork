/** Defer source-owned geometry while keeping ordinary cloneable level data. */
export function lazySource<T>(build:()=>T):()=>T {
  let ready=false,value:T;
  return ()=>{
    if(!ready){value=build();ready=true;}
    return value;
  };
}

/** Materialize once as a normal writable field. An editor assignment before
 * first read replaces the source recipe without running it. Failed builds retry. */
export function lazySourceField<T extends object,K extends keyof T>(target:T,key:K,build:()=>T[K]):void {
  const store=(receiver:T,value:T[K])=>Object.defineProperty(receiver,key,{value,writable:true,enumerable:true,configurable:true});
  Object.defineProperty(target,key,{
    enumerable:true,configurable:true,
    get(){const value=build();store(this,value);return value;},
    set(value:T[K]){store(this,value);},
  });
}
