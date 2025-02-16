import fs from "node:fs";
import { uint8ArrayToNumber, base64Decode } from "./crypto";

export class BundleReader {
    constructor(bundleFilePath) {
        this.bundleFilePath = bundleFilePath;
        this.isInited = false;  // 是否已经初始化
        this.bundleStats = null;
        this.VirtualFileMetaList = [];
        this.fileReadThreshold = 102400; // 切换读取方式的阈值，小文件直接读取返回字节数组，大文件返回一个可读流，默认为100KB
    }

    async init() {
        const checkStatus = await this.checkBundleFile();
        if (checkStatus) {
            this.isInited = true;
            await this.getVirtualFileMetaList();
        }
    }

    async read(virtualPath) {
        return new Promise((resolve) => {
            const fileMeta = this.getVirtualFileMeta(virtualPath);
            if (fileMeta == null) {
                resolve(null);
            } else {
                const size = fileMeta.size;
                const offset = fileMeta.offset;
                const contentType = fileMeta.contentType;
                if (size <= 102400) {
                    // 小文件直接读取返回
                    fs.open(this.bundleFilePath, 'r', (openErr, fd) => {
                        if (openErr) {
                            console.log(openErr);
                            resolve(null);
                        } else {
                            const cache = new Uint8Array(size);
                            fs.read(fd, cache, 0, size, offset, (readErr, readSize, byteArray) => {
                                if (readErr) {
                                    console.log(readErr);
                                    resolve(null);
                                } else {
                                    resolve({ contentType, readSize, dataType: 'Uint8Array', data: byteArray })
                                }
                            });
                        }
                    });
                } else {
                    // 大文件返回一个可读流
                    const fd = fs.openSync(this.bundleFilePath, 'r');
                    const initialOffset = offset; // 初始偏移量
                    const readEndOffset = initialOffset + size; // 读取终点的偏移量

                    let readingFileOffset = initialOffset; // 当前读取文件的偏移量
                    const readChunkSize = 102400; //设定每次读取的字节长度

                    const data = new ReadableStream({
                        start: (controller) => {
                            function pushData() {
                                const cache = new Uint8Array(readChunkSize);
                                fs.read(fd, cache, 0, readChunkSize, readingFileOffset, (err, readedByteSzie, readedArray) => {
                                    if (err) {
                                        controller.error(err);
                                    } else {
                                        readingFileOffset += readedByteSzie; 
                                        console.log(`${readingFileOffset}/${readEndOffset}  ${readingFileOffset-initialOffset}/${size} read_len=${readedArray.length}`);
                                        
                                        if(readingFileOffset < readEndOffset){
                                            controller.enqueue(readedArray);
                                            pushData(); 
                                        }else if(readingFileOffset === readEndOffset){
                                            controller.enqueue(readedArray);
                                            fs.closeSync(fd); 
                                            controller.close(); 
                                        }else {
                                            // 读取的偏移量已超过结束偏移量
                                            controller.enqueue(readedArray.slice(0, readedByteSzie - (readingFileOffset - readEndOffset)));
                                            fs.closeSync(fd); 
                                            controller.close(); 
                                        }
                                    }
                                });
                            }
                            pushData(); 
                        }
                    });
                    resolve({ contentType, readSize:size, dataType: 'ReadableStream', data });
                }
            }
        })
    }

    async getVirtualFileMetaList() {
        return new Promise((resolve) => {
            if (this.isInited === false) {
                resolve(false);
            } else {
                fs.open(this.bundleFilePath, 'r', (openErr, fd) => {
                    if (openErr) {
                        console.log(openErr);
                        fs.closeSync(fd);
                        resolve(false);
                    } else {
                        const metaSizeData = new Uint8Array(8);
                        const stats = this.bundleStats;
                        if (stats) {
                            fs.read(fd, metaSizeData, 0, 8, stats.size - 8, (readErr, readSize, readArray) => {
                                if (readErr) {
                                    console.log(readErr);
                                    fs.closeSync(fd);
                                    resolve(false);
                                } else {
                                    console.log(`读取字节数：${readSize}`);
                                    console.log(readArray);
                                    const len = uint8ArrayToNumber(readArray);
                                    const metaData = new Uint8Array(len);
                                    fs.read(fd, metaData, 0, len, stats.size - 8 - len, (readMetaDataErr, readMetaDataSize, readMetaDataArray) => {
                                        if (readMetaDataErr) {
                                            console.log(readMetaDataErr);
                                            fs.closeSync(fd);
                                            resolve(false);
                                        } else {
                                            console.log(`读取字节数：${readMetaDataSize}`);
                                            const str = (new TextDecoder()).decode(readMetaDataArray);
                                            this.VirtualFileMetaList = JSON.parse(base64Decode(str));
                                            fs.closeSync(fd);
                                            resolve(true);
                                        }
                                    });
                                }
                            });
                        } else {
                            console.log('[BundleReader] class never init.');
                            fs.closeSync(fd);
                            resolve(false);
                        }
                    }
                });
            }
        });
    }

    async checkBundleFile() {
        return new Promise((resolve) => {
            // 检查打包文件是否存在
            fs.stat(this.bundleFilePath, (err, stats) => {
                if (err) {
                    console.log("[BundleReader] can't open bundle file: " + this.bundleFilePath);
                    console.log(err);
                    resolve(false);
                } else {
                    this.bundleStats = stats;
                    if (stats.isFile()) {
                        resolve(true);
                    } else {
                        console.log("[BundleReader] bundle file is not a file: " + this.bundleFilePath);
                        resolve(false);
                    }
                }
            });
        });
    }

    getVirtualFileMeta(virtualPath) {
        for (const fileMeta of this.VirtualFileMetaList) {
            if (fileMeta?.path === virtualPath) {
                return fileMeta;
            }
        }
        return null;
    }
}

/**
 * 读取文件流，写到本地
 * @param {ReadableStreamDefaultReader} reader 
 * @param {string} localFilePath 
 */
export async function readStreamToLocalFile(reader, localFilePath) {
    while (true) {
        const { value, done } = await reader.read();
        // console.log('接收文件流：');
        // console.log(value);
        if (value) {
            fs.appendFileSync(localFilePath, value);
        }
        if (done) {
            console.log('done');
            break;
        }
    }
    return 0;
}