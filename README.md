# mk_files_bundle
基于Bun，打包一个目录，制作简易的虚拟文件系统的程序

在使用该脚本时应提前安装好bun!!!

1、打包目录：

下面的命令中的bbrp是编译之后的单个可执行文件的名称

使用方式：
```
bbrp -c <dir1> -o <dir2> -p <password_str> 将 dir1 目录整体打包为一个文件，使用 password_str 作为密钥进行加密，落地到 dir2 目录下，dir2 目录默认为命令执行的当前目录

bbrp -e <pack_file_path> -o <dir> -p <password_str> 将 pack_file_path 路径指向的打包文件，解包到 dir 目录下，如果是加密后的打包文件，需要提供 password_str 解密密钥
```
options 参数选项：

    -c create 等待打包的目录，将作为打包文件树的根节点
    
    -o output 输出打包文件的目录
    
    -e extract 解包的打包文件的文件路径
    
    -p password 加密-解密密钥（UTF-8编码）


2、使用：

src/read_bundle.ts 是加载和读取打包文件的模块。

里面的test函数展示了使用方法

可以执行下面的命令测试：
```
bun run read_bundle.ts
```
