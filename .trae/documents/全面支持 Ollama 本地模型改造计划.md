## 改造目标
- 统一以 OpenAI 兼容协议调用，使主推理与嵌入均可指向本地 Ollama。
- 提供“模型选择”能力：动态读取本地已拉取的 Ollama 模型，前端可切换并生效。
- 默认优先使用本地模型，无外网依赖；TTS 仍保持可选（本地或禁用）。

## 现状与差距
- 现状：主推理与嵌入以 OpenAI 兼容接口抽象，配置通过 `LLM_BINDING_HOST/LLM_MODEL/LLM_BINDING_API_KEY` 等；多处直接用 `openai` SDK 或 `openai_*` 封装；设置页可动态更新 env。
- 差距：
  - 未内建 Ollama 模型列表拉取与“可选模型”UI/接口。
  - 部分直接使用 `AsyncOpenAI`/`OpenAI` 的调用需确保 `base_url=http://localhost:11434/v1` 且允许无密钥。
  - 嵌入模型需要明确支持 Ollama 的 OpenAI 兼容 `/v1/embeddings`（或回退到原生 `/api/embeddings`）。

## 后端改造
- 统一 OpenAI 兼容入口
  - 在 `src/core/core.py` 提供 `get_llm_client()`/`get_embedding_client()` 工厂，统一读取 `LLM_BINDING_HOST`、`LLM_BINDING_API_KEY`，对本地 `ollama` 允许无密钥与 `http://localhost:11434/v1`。
  - 将分散的 `AsyncOpenAI/OpenAI` 初始化收敛到上述工厂；`openai_complete_if_cache` 与 `openai_embed` 内部改用统一的 `base_url` 与鉴权。
- 增加 Ollama 模型列表 API
  - 在 `src/api/routers/settings.py` 新增 `GET /api/models`：当 `LLM_BINDING_HOST` 指向 `http://localhost:11434` 时，调用 `GET /api/tags`（原生）或 `/v1/models`（兼容端点）返回本地模型列表（name、digest、size）。
  - 提供 `POST /api/settings/model` 设置当前 `LLM_MODEL`；校验模型存在并回写到运行态 env（与现有 `/api/settings/env` 一致）。
- 运行时模型切换
  - 所有调用点读取 `LLM_MODEL` 时不缓存模型名，按次读取或监听变更；保证切换后新请求生效。
- 嵌入模型支持
  - `openai_embed` 优先调用 `/v1/embeddings`；若检测到 `ollama` 且失败，则回退到原生 `/api/embeddings`（JSON 结构适配）。
  - `.env` 增加本地嵌入模型示例（如 `nomic-embed-text`、`mxbai-embed-large`）。
- 健康检查与错误提示
  - 在 `src/api/routers/system.py` 健康检查增加：
    - 检查 `http://localhost:11434` 可达；
    - 当 `LLM_MODEL` 未设置或模型不存在时给出明确错误与引导（提示使用设置页拉取模型）。
- TTS 处理
  - 保持 TTS 可选；若未配置本地 TTS，相关功能不报错，提示“未启用 TTS”。

## 前端/设置界面改造
- 设置页新增“模型选择”区域：
  - 调用 `GET /api/models` 列出本地模型；
  - 支持搜索与选择，点击后调用 `POST /api/settings/model`；
  - 显示当前生效模型与基础端点（只读）。
- 可选：嵌入模型下拉选择，与主模型独立配置。

## 配置与文档
- `.env.example` 增补本地示例：
  - `LLM_BINDING=ollama`
  - `LLM_BINDING_HOST=http://localhost:11434/v1`
  - `LLM_MODEL=llama3.2:3b`
  - `EMBEDDING_MODEL=nomic-embed-text`
  - `LLM_BINDING_API_KEY=`（留空）
- `README`/部署文档：
  - 安装与启动 Ollama；如何 `ollama pull llama3.2`；
  - 如何在设置页选择模型；FAQ（端口不通、模型未下载、无密钥）。

## 验证与测试
- 增加后端集成测试/脚本：
  - `LLM`：用当前模型生成一句话（system/health 路由触发）。
  - `Embeddings`：对固定短文本生成嵌入，断言向量长度。
- 手动验收：
  - 未运行 Ollama → 健康检查提示；
  - 运行 Ollama、未拉取模型 → 列表为空提示；
  - 拉取模型后 → 设置页选择生效，RAG/Agents/Question 模块均可运行。

## 迁移与回滚
- 兼容现有远端供应商：若 `LLM_BINDING_HOST` 非本地，保持原行为。
- 回滚仅需还原 `.env` 与设置；代码路径统一兼容，不引入供应商特定分支逻辑。