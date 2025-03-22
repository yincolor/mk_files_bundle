

/*
使用方式：
bbrp -c <dir1> -o <dir2> -p <password_str> 将 dir1 目录整体打包为一个文件，使用 password_str 作为密钥进行加密，落地到 dir2 目录下，dir2 目录默认为命令执行的当前目录
bbrp -e <pack_file_path> -o <dir> -p <password_str> 将 pack_file_path 路径指向的打包文件，解包到 dir 目录下，如果是加密后的打包文件，需要提供 password_str 解密密钥

options 参数选项：
    -c create 等待打包的目录，将作为打包文件树的根节点
    -o output 输出打包文件的目录
    -e extract 解包的打包文件的文件路径
    -p password 加密-解密密钥（UTF-8编码）
*/
import arg from "arg";


export type ArgsParseReturnType = {
    commandType: 'pack', 
    isCrypto: boolean,
    packDir: string,
    outputDir:string|undefined
    password: string|undefined
}|{
    commandType: 'unpack', 
    isCrypto: boolean,
    unpackFilePath:string,
    outputDir:string|undefined,
    password:string|undefined
}



// 解析当前命令的参数
export function argsParse():ArgsParseReturnType{
    const args = arg({
        '--create': String,
        '--output': String,
        '--extract': String,
        '--password': String,
    
        '-c': '--create',
        '-o': '--output',
        '-e': '--extract',
        '-p':'--password',  
    });
    if(args['--create'] && args['--create'].length > 0){
        // 打包命令
        return {
            commandType: 'pack',
            isCrypto: (args['--password'] && args['--password'].length > 0)?true:false,
            packDir: args['--create'],
            outputDir: args['--output'], 
            password: args['--password'], 
        }
    }else if(args['--extract'] && args['--extract'].length > 0){
        // 解包命令
        return {
            commandType: 'unpack',
            isCrypto: (args['--password'] && args['--password'].length > 0)?true:false,
            unpackFilePath: args['--extract'],
            outputDir: args['--output'], 
            password: args['--password'], 
        }
    }else {
        // 异常
        throw new Error("-c [--create] 或 -e [--extract] 参数异常，请检查");
    }
}
