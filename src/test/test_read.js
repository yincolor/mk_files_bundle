import { BundleReader, readStreamToLocalFile } from "../read_bundle";
import path from "node:path";


const b = new BundleReader(path.resolve(import.meta.dir, '../../out/pack.bin'));
b.init().then(() => {
    console.log('初始化成功');

    console.log(b.isInited);
    // b.read('/css/style.css').then((val) => {
    //     console.log(Buffer.from(val.data, 'utf-8').toString());
    // });

    // b.read('/img/格雷西阿姨/004.jpg').then((val) => {
    //     console.log(val);
    //     /** @type {ReadableStream} */
    //     const readableStream = val.data;
    //     /** @type {ReadableStreamDefaultReader} */
    //     const readableStreamReader = readableStream.getReader();

    //     readStreamToLocalFile(readableStreamReader, './out.jpg').then(() => {
    //         console.log('文件写入成功');
    //     });
    // });

    // b.read('/video/竖屏1.flv').then((val) => {
    //     console.log(val);
    //     /** @type {ReadableStream} */
    //     const readableStream = val.data;
    //     /** @type {ReadableStreamDefaultReader} */
    //     const readableStreamReader = readableStream.getReader();

    //     readStreamToLocalFile(readableStreamReader, './竖屏1.flv').then(() => {
    //         console.log('文件写入成功');
    //     });
    // });

    b.read('/video/老视频1.mp4').then((val) => {
        console.log(val);
        /** @type {ReadableStream} */
        const readableStream = val.data;
        /** @type {ReadableStreamDefaultReader} */
        const readableStreamReader = readableStream.getReader();

        readStreamToLocalFile(readableStreamReader, './老视频1.mp4').then(() => {
            console.log('文件写入成功');
        });
    });
})
