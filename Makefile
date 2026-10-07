.PHONY: build test vet frontend ipx clean

# PigeonBox OpenWrt/iStoreOS 适配层
# 独立构建钉 go.mod 正式版本(core v0.13.0);在 hub 工作区内直接跑会拾取
# 上层 go.work 联编本地 core,GOWORK=off 强制钉版构建,两者皆可。

build:            ## 编译本机二进制(dist/pigeonbox,默认 static-dir 指向包内路径)
	go build -o dist/pigeonbox ./cmd/pigeonbox

test:
	go test ./... -race

vet:
	go vet ./...

frontend:         ## 构建前端 dist(优先工作区 frontend 仓)→ dist/www
	./scripts/build-frontend.sh

ipk:              ## 组装本机架构冒烟 ipk(需先 build + frontend)
	./scripts/build-ipk.sh x86_64 0.0.0-dev

clean:
	rm -rf dist/ .frontend-src/
