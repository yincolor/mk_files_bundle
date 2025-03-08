import type { BunFile } from "bun";
import { uint8ArrayToNumber, base64Decode, simpleDecryption } from "./crypto";

// export const bundleFile = Bun.file('../output/pack.bin'); 

export class BundleReader {
    /** 打包文件的路径 */
    bundleFile: BunFile;
    /** 虚拟文件的元数据列表 */
    VirtualFileMetaList: VirtualFileMeta[] = [];
    /** 文件读取的步长/阈值 默认为100KB 小文件直接读取返回字节数组，大文件返回一个可读流 */
    fileReadThreshold: number = 102400;
    /** 解密密钥，默认为null，即无需解密 */
    key: number | null = null;
    constructor(_bundleFile: string | BunFile) {
        if (typeof _bundleFile === 'string') {
            this.bundleFile = Bun.file(_bundleFile);
        } else {
            this.bundleFile = _bundleFile
        }
        if (this.bundleFile.size <= 0) {
            throw new Error("[BundleReader.constructor] Error: \nBundule File Size is 0 !!! Please check if the file exists !!!\n打包文件体积为 0 !!! 请检查是否存在该文件!!!");
        }
    }

    /** 初始化 */
    async init() {
        await this.#initVirtualFileMeta();
    }

    /** 初始化虚拟文件的元数据 */
    async #initVirtualFileMeta() {
        if ((await this.bundleFile.exists()) === false) {
            throw new Error("[BundleReader.init] Error: \nBundule File is NOT EXISTS!!!\n打包文件没有被加载到!!!");
        } else {
            const bundleFileSize = this.bundleFile.size;
            const metaSizeData = await (this.bundleFile.slice(bundleFileSize - 8, "application/octet-stream")).bytes();
            // console.log(metaSizeData);
            const metaSize = uint8ArrayToNumber(metaSizeData);
            // console.log('元数据长度：', metaSize);
            const str = await (this.bundleFile.slice(bundleFileSize - metaSize - 8, bundleFileSize - 8, "text/plain")).text();
            // console.log(str);
            // const base64Str = base64Decode(str); 
            // console.log(base64Str);
            const virtualMeta: { data: VirtualFileMeta[], key: number | null } = JSON.parse(base64Decode(str));
            this.VirtualFileMetaList = virtualMeta.data;
            this.key = virtualMeta.key;
            // console.log(this.VirtualFileMetaList);
            // console.log(this.key);
        }
    }

    /** 根据虚拟路径获取文件元数据 */
    getVirtualFileMeta(virtualPath: string) {
        for (const fileMeta of this.VirtualFileMetaList) {
            if (fileMeta.path === virtualPath) {
                return fileMeta;
            }
        }
        return null;
    }
    /** 读取打包文件中的一个文件 */
    async read(virtualPath: string): Promise<{ contentType: string, readSize: number, dataType: 'Uint8Array', data: Uint8Array } | { contentType: string, readSize: number, dataType: 'ReadableStream', data: ReadableStream } | null> {
        const fileMeta = this.getVirtualFileMeta(virtualPath);
        if (fileMeta === null) {
            return null;
        } else {
            const size = fileMeta.size;
            const offset = fileMeta.offset;
            const contentType = fileMeta.contentType;
            if (size <= this.fileReadThreshold) {
                // 小文件直接读取返回
                const data = await this.bundleFile.slice(offset, offset + size, "application/octet-stream").bytes();
                return { contentType, readSize: data.byteLength, dataType: 'Uint8Array', data: this.key === null ? data : simpleDecryption(data, this.key) };
            } else {
                // 大文件返回一个可读流
                const initialOffset = offset; // 初始偏移量
                const readEndOffset = initialOffset + size; // 读取终点的偏移量
                let readingFileOffset = initialOffset; // 当前读取文件的偏移量
                const readChunkSize = this.fileReadThreshold; //设定每次读取的字节长度
                const data = new ReadableStream({
                    start: async (controller) => {
                        const bunFile = this.bundleFile;
                        const key = this.key;
                        while (true) {
                            const cache = new Uint8Array(readChunkSize);
                            const readedArray = await bunFile.slice(readingFileOffset, readingFileOffset + readChunkSize, "application/octet-stream").bytes();
                            readingFileOffset += readedArray.byteLength;
                            // console.log(`${readingFileOffset}/${readEndOffset}  ${readingFileOffset-initialOffset}/${size} read_len=${readedArray.byteLength}`);
                            if (readingFileOffset < readEndOffset) {
                                controller.enqueue(key === null ? readedArray : simpleDecryption(readedArray, key));
                                // pushData(bunFile, key); 
                            } else if (readingFileOffset === readEndOffset) {
                                controller.enqueue(key === null ? readedArray : simpleDecryption(readedArray, key));
                                controller.close();
                                break; 
                            } else {
                                // 读取的偏移量已超过结束偏移量
                                const arr = readedArray.slice(0, readedArray.byteLength - (readingFileOffset - readEndOffset));
                                controller.enqueue(key === null ? arr : simpleDecryption(arr, key));
                                controller.close();
                                break; 
                            }
                        }
                    }
                });
                return { contentType, readSize: size, dataType: 'ReadableStream', data };
            }
        }
    }
}

/** 虚拟文件元数据 */
type VirtualFileMeta = { path: string, offset: number, size: number, contentType: string };