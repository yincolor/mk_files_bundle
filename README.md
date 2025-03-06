# mk_files_bundle
基于Bun，打包一个目录，制作简易的虚拟文件系统的程序

在使用该脚本时应提前安装好bun!!!

1、打包目录：

执行命令：
```
bun run src/main.ts -i ./test/ -o ./output/pack.bin -key 123
```
会在output目录下生成一个文件，存储了打包后的数据的二进制文件。

2、使用：

src/read_bundle.ts 是加载和读取打包文件的模块。

src/test/tes_read.ts 展示了该模块的使用方法。

可以执行下面的命令测试：
```
bun run src/test/test_read.ts
```
