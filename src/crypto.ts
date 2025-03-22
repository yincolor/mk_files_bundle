
let utf8TextDecoder:TextDecoder = new TextDecoder();
let utf8TextEncoder: TextEncoder = new TextEncoder();



// 生成密钥 AES CBC 256
async function generateKey_AES_CBC_256(password: string) {
    const passwordData = utf8TextEncoder.encode(password);
    const digestData = await crypto.subtle.digest('SHA-256', passwordData);
    const key = await crypto.subtle.importKey('raw', new Uint8Array(digestData), { name: 'AES-CBC', length: 256 }, false, ['encrypt', 'decrypt']); // 加密密钥
    console.log('[crypto] 生成密钥', digestData);

    const iv = new Uint8Array(digestData.slice(16, 32)); // 初始化向量
    console.log('[crypto] 生成向量:', iv);
    return { key, iv };
}

// 加密 AES-CBC 256 
async function encrypt_AES_CBC_256(data: Uint8Array, key: CryptoKey, iv: Uint8Array) {
    return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv }, key, data));
}

// 解密 AES-CBC 256 
async function decrypt_AES_CBC_256(data: Uint8Array, key: CryptoKey, iv: Uint8Array) {
    console.log(`[decrypt_AES_CBC_256] 开始解密 向量长度: ${iv.byteLength} 密钥类型: ${key.type} ${key.algorithm.name}`);
    console.log(`[decrypt_AES_CBC_256] 开始解密 数据长度: ${data.byteLength}`);
    const a = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, key, data); 
    console.log('[decrypt_AES_CBC_256] 解密长度:', a.byteLength);
    
    return new Uint8Array(a);
}



function base64Encoding(nomalStr:string) {
    return utf8TextEncoder.encode(nomalStr).toBase64({alphabet:'base64'}); 
}
function base64Decoding(base64Str:string) {
    const buffer = Buffer.from(base64Str, 'base64');
    const decodeStr = buffer.toString('utf-8')
    return decodeStr; 
}

function randomNumberBetween(start:number, end:number){
    return Math.floor(Math.random()*(end-start))+start; 
}

/** 异或编码 单个字节进行异或计算 */
function xorOneByte (data:Uint8Array, xorByte:number) {
    if(xorByte <=0 || xorByte > 255){
        throw new Error(`xor Byte Must Between 0 And 255, But Now Is ${xorByte}`);
    }
    const DataByteLength = data.byteLength; 
    const newData = new Uint8Array(DataByteLength);
    for(let i=0;i<DataByteLength;i++){
        newData[i] = data[i] ^ xorByte; 
    }
    return newData; 
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


export const cryptoUtil = {
    aes: {
        encrypt: encrypt_AES_CBC_256,
        decrypt: decrypt_AES_CBC_256,
        generateKey: generateKey_AES_CBC_256
    },
    base64:{
        encode:base64Encoding,
        decode:base64Decoding
    },
    xor: xorOneByte,
    random:{
        num:randomNumberBetween, 
        byteArray: (len:number)=>{
            const arr = []; 
            for(let i=0;i<len;i++){
                arr.push(randomNumberBetween(0,254)); 
            }
            return new Uint8Array(arr); 
        }
    }
}

async function test() {
    // const { key, iv } = await generateKey_AES_CBC_256('你好，我是密码');
    const data = crypto.getRandomValues(new Uint8Array(24));
    console.log('原始数据:', data);
    console.log(`原始数据长度: ${data.length}`);

    const encryptData = xorOneByte(data, 0x11);  // await encrypt_AES_CBC_256(data, key, iv);
    console.log('加密数据:', encryptData);
    console.log(`加密数据长度: ${encryptData.length}`);
    
    const decryptData = xorOneByte(encryptData, 0x11);  
    console.log('解密数据:', decryptData);
    console.log(`解密数据长度: ${decryptData.length}`);
}
// test()