package domain

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/wangArtsoar/gemini-ai/configuration"
	"io"
	"log"
	"net/http"
	"strings"
)

type RequestBody struct {
	Contents         []*Content `json:"contents"`
	GenerationConfig any        `json:"generation_config,omitempty"`
}

type Part struct {
	Text       string      `json:"text,omitempty"`
	InlineData *InlineData `json:"inlineData,omitempty"`
}

type InlineData struct {
	MimeType string `json:"mimeType"`
	Data     []byte `json:"data"`
}

type Content struct {
	ContentID *int64  `json:"content_id,omitempty"`
	Parts     []*Part `json:"parts,omitempty"`
	Role      string  `json:"role"`
}

type GeminiResponse struct {
	Candidates []struct {
		Content      *Content
		FinishReason *string  `json:"finishReason,omitempty"`
		AvgLogprobs  *float64 `json:"avgLogprobs,omitempty"`
		Index        *int     `json:"index,omitempty"`
	} `json:"candidates"`
	UsageMetadata struct {
		PromptTokensDetails []*struct {
			Modality   string `json:"modality"`
			TokenCount int    `json:"tokenCount"`
		} `json:"promptTokensDetails,omitempty"`

		PromptTokenCount     *int `json:"promptTokenCount,omitempty"`
		CandidatesTokenCount *int `json:"candidatesTokenCount,omitempty"`
		TotalTokenCount      *int `json:"totalTokenCount,omitempty"`
	} `json:"usageMetadata,omitempty"`
	ModelVersion string `json:"modelVersion"`
}

// 准备请求体
func (r *RequestBody) prepareRequestBody(input configuration.UserInput) ([]byte, error) {
	content := Content{
		Role:  "user",
		Parts: make([]*Part, 0),
	}

	// 处理所有图片数据
	for _, fileBase64 := range input.Files {
		if fileBase64.Data != nil {
			content.Parts = append(content.Parts, &Part{
				InlineData: &InlineData{
					MimeType: fileBase64.MimeType,
					Data:     fileBase64.Data,
				},
			})
		}
	}

	// 只有在有消息时才添加文本部分
	if input.Message != "" {
		content.Parts = append(content.Parts, &Part{
			Text: input.Message,
		})
	}

	// 只有在有内容时才添加到 Contents
	if len(content.Parts) > 0 {
		r.Contents = append(r.Contents, &content)
	}

	if configuration.DefaultModelInt == configuration.EnvMap["GEMINI_MODEL_2_EXP"] {
		r.GenerationConfig = map[string]interface{}{"response_modalities": []string{"Text", "Image"}}
	}
	body, err := json.Marshal(r)
	if err != nil {
		return nil, fmt.Errorf("error marshalling request body: %v", err)
	}
	return body, nil
}

// 发送请求并返回响应
func (r *RequestBody) sendRequest(body []byte) (*http.Response, error) {
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, body, "", "    "); err != nil {
		log.Printf("Failed to format request body: %v", err)
	} else {
		log.Printf("Request body:\n%s", prettyJSON.String())
	}
	req, err := http.NewRequest("POST", configuration.BuildAIApi(configuration.DefaultModelInt, ""), bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	//fmt.Println(configuration.AIApi)
	req.Header.Set("Content-Type", "application/json")
	// 添加 API Key 到请求头
	req.Header.Set("x-goog-api-key", configuration.AIApi)

	// 尝试使用当前客户端发送请求
	if configuration.CurrentClient == nil {
		configuration.CurrentClient = configuration.HttpClientWithPort
	}
	resp, err := configuration.CurrentClient.Do(req)

	// 如果请求失败，切换到另一个客户端重试
	if err != nil || (resp != nil && resp.StatusCode != http.StatusOK) {
		if configuration.CurrentClient == configuration.HttpClientWithPort {
			configuration.CurrentClient = configuration.HttpClientWithout
		} else {
			configuration.CurrentClient = configuration.HttpClientWithPort
		}
		resp, err = configuration.CurrentClient.Do(req)
	}

	if err != nil {
		return nil, fmt.Errorf("request failed with both clients: %v", err)
	}

	if resp == nil {
		return nil, fmt.Errorf("no response from server")
	}

	if resp.StatusCode != http.StatusOK {
		configuration.HttpState = resp.StatusCode
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		log.Println(string(body))
		return nil, fmt.Errorf("request failed with status code: %d", resp.StatusCode)
	}

	return resp, nil
}

// Result 用来保存完整的输出内容
var Result strings.Builder

// 处理 SSE 流式数据
func (r *RequestBody) handleSSEResponse(w http.ResponseWriter, resp *http.Response) error {
	defer func() {
		configuration.IsStopSSE = false
	}()
	// 设置响应头
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	buf := make([]byte, 1024)
	Result.Reset()
	for {
		n, err := resp.Body.Read(buf)
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("error reading response body: %v", err)
		}

		data := buf[:n]
		if !strings.HasPrefix(string(data), "data: ") {
			continue
		}

		var geminiResponse GeminiResponse
		dataStr := string(data)
		lines := strings.Split(dataStr, "\n") // 按行分割
		var jsonData string
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "data:") {
				jsonData = strings.TrimSpace(line[5:])
				break
			}
		}

		if jsonData == "" {
			continue // 没有找到 data 行，继续处理下一条消息
		}

		if err = json.Unmarshal([]byte(jsonData), &geminiResponse); err != nil {
			continue
		}

		// 输出候选内容并收集到 result 中
		for _, candidate := range geminiResponse.Candidates {
			for _, part := range candidate.Content.Parts {
				if configuration.IsStopSSE {
					return nil
				}
				Result.WriteString(fmt.Sprint(part.Text))   // 将文本追加到 result 中
				_, _ = fmt.Fprint(w, fmt.Sprint(part.Text)) // 继续实时输出到客户端
				w.(http.Flusher).Flush()                    // 刷新流，保持 SSE 连接
			}
		}
	}

	return nil
}

// 处理 JSON 响应 (改进版)
func (r *RequestBody) handleJSONResponse(w http.ResponseWriter, resp *http.Response) (*GeminiResponse, error) {
	// 2. 解析 JSON
	var geminiResponse GeminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&geminiResponse); err != nil {
		return nil, fmt.Errorf("error decoding JSON response: %v", err)
	}
	w.Write([]byte{})
	return &geminiResponse, nil
}
