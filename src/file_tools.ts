import fs from "node:fs";
import path from "node:path";

export const CHUNK_SIZE: number = 102400; // 100K 字节为读取桶的大小

/** 创建一个空文件，如果路径下本来就有文件，则覆盖为空文件 */
export function createEmptyFile(filePath: string) {
    const dirPath = path.dirname(filePath);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(filePath, '', {})
}

/** 将文件数据追加到另一文件的后面 */
export async function appendFileBufferToFile(fromFilePath: string, fromFileByteSize: number, toFilePath: string, preProcessByteDataCallback: ((data: Buffer<ArrayBufferLike>) => Buffer<ArrayBufferLike>) | null = null): Promise<boolean> {
    return new Promise(resolve => {
        if (fromFileByteSize <= CHUNK_SIZE) {
            try {
                let buffer = readFileDirectly(fromFilePath);
                // 如果设置了预处理的函数，则执行预处理函数
                if (preProcessByteDataCallback) {
                    buffer = preProcessByteDataCallback(buffer);
                }
                fs.appendFileSync(toFilePath, new Uint8Array(buffer));
                resolve(true);
            } catch (error) {
                console.log(error);
                resolve(false);
            }
        } else {
            readFileStream(fromFilePath, {
                onDataRead: (chunk) => {
                    let buffer = chunk; 
                    // 如果设置了预处理的函数，则执行预处理函数
                    if(preProcessByteDataCallback){
                        buffer = preProcessByteDataCallback(buffer);
                    }
                    fs.appendFileSync(toFilePath, new Uint8Array(buffer));
                },
                onError: (err) => {
                    console.log(err);
                },
            }).then((isOk) => {
                if (isOk) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        }
    });
}

/** 直接读取文件（小文件读取） */
export function readFileDirectly(filePath: string) {
    return fs.readFileSync(filePath);
}

type readFileStreamOption = {
    onDataRead: (chunk: Buffer) => void,
    onError: (err: Error) => void
}
/** 流式读取文件（大文件读取） */
export async function readFileStream(filePath: string, option: readFileStreamOption): Promise<boolean> {
    return new Promise(resolve => {
        // let num = 0;
        const readStream = fs.createReadStream(filePath, { flags: 'r', highWaterMark: CHUNK_SIZE }); // 每次读100KB大小的的数据块
        readStream.on('data', (chunk: string|Buffer) => {
            const _data = chunk; 
            if(typeof _data === 'string'){
                const _data_buffer = Buffer.from(_data);
                option.onDataRead(_data_buffer);
            }else {
                option.onDataRead(_data);
            }
        });
        readStream.on('end', () => {
            // console.log('文件读取完毕');
        });
        readStream.on('error', (err) => {
            option.onError(err);
            readStream.close();
            resolve(false);
        });
        readStream.on('close', () => {
            // console.log('读取流已关闭');
            resolve(true);
        });
        readStream.on('open', (fd) => {
            // console.log(`读取流已打开，文件描述符：${fd}`);
        });
    });
}