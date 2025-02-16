/** 字符串转Base64 */
export const base64Encode = (str:string) => {
    const buffer = Buffer.from(str, 'utf-8');
    return buffer.toString('base64'); 
}
/** Base64转字符串 */
export const base64Decode = (base64Str:string) => {
    const buffer = Buffer.from(base64Str, 'base64'); 
    return buffer.toString('utf-8'); 
}

/** 数字转为Uint8Array */
export const numberToUint8Array = (num:number, arraySize:number) =>{
    const byteArray = new Uint8Array(arraySize);
    let calcNumber = num;  
    for (let i = 0; i < arraySize; i++) {
        // 使用位操作提取每个字节的值
        byteArray[i] = calcNumber % 256;
        calcNumber = Math.floor(calcNumber/256); 
    }
    return byteArray; 
}
/** Uint8Array 转为 数字 */
export const uint8ArrayToNumber = (byteArray:Uint8Array) =>{
    const arraySize = byteArray.length; 
    let num = 0; 
    for (let i = arraySize - 1; i >= 0; i--) {
        // 将每个字节的值左移 (i * 8) 位，然后使用按位或合并
        num = num * 256 + byteArray[i];
    }
    return num; 
}

/** 简单加密 */
export const simpleEncryption = (byteArray: Uint8Array, key:number)=>{
    if(key > 0xff){
        throw new Error("key 超过了限制，应小于等于255");
    }else if(key <= 0){
        throw new Error("key 超过了限制，应大于0");
    }else {
        const arrLen = byteArray.length;
        const newArray = new Uint8Array(arrLen);  
        for(let i=0;i<arrLen;i++){
            newArray[i] = byteArray[i] ^ key; 
        }
        return newArray; 
    }
}
/** 简单解密 */
export const simpleDecryption = (byteArray: Uint8Array, key:number)=>{
    if(key > 0xff){
        throw new Error("key 超过了限制，应小于等于255");
    }else if(key <= 0){
        throw new Error("key 超过了限制，应大于0");
    }else {
        const arrLen = byteArray.length;
        const newArray = new Uint8Array(arrLen);  
        for(let i=0;i<arrLen;i++){
            newArray[i] = byteArray[i] ^ key; 
        }
        return newArray; 
    }
}