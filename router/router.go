package router

import (
	"encoding/json"
	"fmt"
	"github.com/wangArtsoar/gemini-ai/configuration"
	"github.com/wangArtsoar/gemini-ai/domain"
	"html/template"
	"log"
	"net/http"
	"strconv"
)

func Register() *http.ServeMux {
	r := http.NewServeMux()
	r.Handle("GET /", http.FileServer(http.FS(*configuration.Fs)))
	r.HandleFunc("GET /index", handleIndex)
	r.HandleFunc("POST /chat", handleChat)
	r.HandleFunc("GET /historyList", handleHistory)
	r.HandleFunc("PUT /findHistory/{id}", handleFindHistory)
	r.HandleFunc("GET /switchModel", handleSwitchModel)
	r.HandleFunc("POST /generateTitle", handleGenerateTitle)
	r.HandleFunc("GET /lastSessionID", handleLastSessionID)
	r.HandleFunc("DELETE /deleteHistory/{id}", handleDeleteHistory)
	r.HandleFunc("PUT /edit-history/{sessionId}", handleEditHistoryTitle)
	r.HandleFunc("GET /getTwoLastContent/{sessionId}", handleTwoLastContent)
	r.HandleFunc("POST /stop", handleStop)
	r.HandleFunc("POST /share/{sessionId}", handleShare)
	r.HandleFunc("GET /videoList", handleVideoList)
	r.HandleFunc("GET /readList", handleReadList)
	r.HandleFunc("GET /videoByFilename/{filename}", handleVideoByFilename)
	r.HandleFunc("GET /readByFilename/{filename}", handleReadByFilename)
	r.HandleFunc("POST /saveVideo", handleSaveVideo)
	r.HandleFunc("POST /saveRead", handleSaveRead)
	r.HandleFunc("DELETE /delVideo/{filename}", handleDelVideo)
	r.HandleFunc("DELETE /delRead/{filename}", handleDelRead)
	return r
}

func handleShare(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("sessionId"))
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusBadRequest)
		return
	}
	err = domain.Share(configuration.DB, int64(id), w)
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusInternalServerError)
		return
	}
}

func handleStop(w http.ResponseWriter, r *http.Request) {
	configuration.IsStopSSE = true
}

func handleTwoLastContent(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("sessionId"))
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusBadRequest)
		return
	}

	type T struct {
		UserContentID int64 `json:"userContentId"`
		AIContentID   int64 `json:"aiContentId"`
	}

	userContent, aiContent, err := domain.GetTwoLastContent(configuration.DB, int64(id))
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusInternalServerError)
		return
	}
	if userContent == nil || aiContent == nil {
		return
	}
	t := T{
		UserContentID: *userContent,
		AIContentID:   *aiContent,
	}
	bytes, err := json.Marshal(&t)
	if err != nil {
		log.Println(err)
		http.Error(w, "Server error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(bytes)
}

func handleEditHistoryTitle(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("sessionId"))
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusBadRequest)
		return
	}

	type T struct {
		Title string `json:"title"`
	}
	var t T
	if err = json.NewDecoder(r.Body).Decode(&t); err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusBadRequest)
		return
	}
	err = domain.EditHistoryTitle(configuration.DB, int64(id), t.Title)
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusInternalServerError)
		return
	}
}

func handleDeleteHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusBadRequest)
		return
	}
	err = domain.DelHistoryBySessionID(configuration.DB, int64(id))
	if err != nil {
		log.Println(err)
		http.Error(w, "Server error: "+err.Error(), http.StatusInternalServerError)
		return
	}
}

func handleLastSessionID(w http.ResponseWriter, r *http.Request) {
	id, err := domain.FindLastSessionID(configuration.DB)
	if err != nil {
		log.Println(err)
		http.Error(w, "Server error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write([]byte(strconv.FormatInt(id, 10)))
}

func handleGenerateTitle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	var userInput configuration.UserInput
	if err := json.NewDecoder(r.Body).Decode(&userInput); err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusBadRequest)
		return
	}

	title, err := domain.GetSessionTitle(userInput)
	if err != nil {
		log.Println(err)
		http.Error(w, "Server error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	bytes, err := json.Marshal(&title)
	if err != nil {
		log.Println(err)
		http.Error(w, "Server error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(bytes)
}

func handleSwitchModel(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	model := values.Get("model")
	configuration.AIApi = configuration.BuildAIApi(model, "")
}

func handleFindHistory(w http.ResponseWriter, r *http.Request) {
	// PUT get id
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to parse request", http.StatusBadRequest)
		return
	}
	body, err := domain.FindHistoryBySessionID(configuration.DB, int64(id), true)
	if err != nil {
		log.Println(err)
		http.Error(w, "Server error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	bytes, err := json.Marshal(&body)
	if err != nil {
		log.Println(err)
		http.Error(w, "Server error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(bytes)
}

func handleHistory(w http.ResponseWriter, r *http.Request) {
	titles, err := domain.FindAllTitle()
	if err != nil {
		log.Println(err)
		return
	}

	bytes, err := json.Marshal(titles)
	if err != nil {
		log.Println(err)
		return
	}
	w.Write(bytes)
}

func handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	var userInput configuration.UserInput
	if r.Body == nil {
		http.Error(w, "Request body is empty", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if err := json.NewDecoder(r.Body).Decode(&userInput); err != nil {
		log.Printf("Failed to parse request body: %v\n", err)
		http.Error(w, "Invalid JSON format in request body", http.StatusBadRequest)
		return
	}

	for _, inlineDataDto := range userInput.Files {
		if _, ok := configuration.CustomMIMEs[inlineDataDto.MimeType]; !ok {
			err := fmt.Errorf("Custom MIME type not recognized: %v\n", inlineDataDto.MimeType)
			log.Println(err)
			http.Error(w, "Server error: "+err.Error(), configuration.HttpState)
			return
		}
	}
	if err := domain.Chat(userInput, configuration.DB, w); err != nil {
		log.Println(err)
		http.Error(w, "Server error: "+err.Error(), configuration.HttpState)
		return
	}
}

// handleIndex 处理首页请求
func handleIndex(w http.ResponseWriter, _ *http.Request) {
	tmpl, err := template.ParseFS(configuration.Fs, "templates/index.html")
	if err != nil {
		log.Println(err)
		return
	}
	data := struct {
		Title string
	}{
		Title: "AI Chat",
	}
	err = tmpl.Execute(w, data)
	if err != nil {
		return
	}
}

// 定义一个合理的内存缓冲大小，例如 32MB
const MaxMemoryBuffer = 32 << 20 // 32MB

// ensureJSONResponse Helper function to set JSON header and encode response
func ensureJSONResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

// handleVideoList 列出所有视频（包括本地和YouTube收藏）
func handleVideoList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	video := domain.Video{}
	videos := video.ListAllVideos()
	ensureJSONResponse(w, videos, http.StatusOK)
}

// handleReadList 列出所有小说
func handleReadList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	read := domain.Read{}
	reads := read.List()
	ensureJSONResponse(w, reads, http.StatusOK)
}

// handleVideoByFilename 根据文件名查找并提供本地视频文件
func handleVideoByFilename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	filename := r.PathValue("filename")
	if filename == "" {
		http.Error(w, "Filename is required", http.StatusBadRequest)
		return
	}
	video := domain.Video{}
	foundVideo := video.FindLocal(filename)
	if foundVideo == nil {
		http.Error(w, "Video not found", http.StatusNotFound)
		return
	}
	if foundVideo.Source == domain.SourceLocal {
		http.ServeFile(w, r, foundVideo.VideoUrl)
	} else {
		http.Error(w, "This is a YouTube video, not a local file.", http.StatusBadRequest)
	}
}

// handleReadByFilename 根据文件名查找并提供小说文件
func handleReadByFilename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	filename := r.PathValue("filename")
	if filename == "" {
		http.Error(w, "Filename is required", http.StatusBadRequest)
		return
	}
	read := domain.Read{}
	foundRead := read.Find(filename)
	if foundRead == nil {
		http.Error(w, "Read not found", http.StatusNotFound)
		return
	}
	http.ServeFile(w, r, foundRead.ReadUrl)
}

// handleSaveVideo 处理视频文件上传
func handleSaveVideo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 解析 multipart/form-data，使用 MaxMemoryBuffer 作为内存上限
	err := r.ParseMultipartForm(MaxMemoryBuffer)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse form: %v", err), http.StatusBadRequest)
		return
	}

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get file from form: %v", err), http.StatusBadRequest)
		return
	}
	defer file.Close()

	targetFilename := fileHeader.Filename
	if targetFilename == "" {
		http.Error(w, "Filename is empty", http.StatusBadRequest)
		return
	}

	video := domain.Video{}
	saveErr := video.SaveLocal(file, targetFilename)
	if saveErr != nil {
		log.Printf("Error saving video file: %v", saveErr)
		http.Error(w, "Failed to save video file: "+saveErr.Error(), http.StatusInternalServerError)
		return
	}

	ensureJSONResponse(w, map[string]string{"message": "Video uploaded and saved successfully", "filename": targetFilename}, http.StatusCreated)
}

// handleSaveRead 处理小说文件上传
func handleSaveRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 解析 multipart/form-data，使用 MaxMemoryBuffer 作为内存上限
	err := r.ParseMultipartForm(MaxMemoryBuffer)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse form: %v", err), http.StatusBadRequest)
		return
	}

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get file from form: %v", err), http.StatusBadRequest)
		return
	}
	defer file.Close()

	targetFilename := fileHeader.Filename
	if targetFilename == "" {
		http.Error(w, "Filename is empty", http.StatusBadRequest)
		return
	}

	read := domain.Read{}
	saveErr := read.Save(file, targetFilename)
	if saveErr != nil {
		log.Printf("Error saving read file: %v", saveErr)
		http.Error(w, "Failed to save read file: "+saveErr.Error(), http.StatusInternalServerError)
		return
	}

	ensureJSONResponse(w, map[string]string{"message": "Read uploaded and saved successfully", "filename": targetFilename}, http.StatusCreated)
}

// handleDelVideo 删除本地视频文件
func handleDelVideo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	filename := r.PathValue("filename")
	if filename == "" {
		http.Error(w, "Filename is required", http.StatusBadRequest)
		return
	}
	video := domain.Video{}
	err := video.RemoveLocal(filename)
	if err != nil {
		log.Printf("Error deleting video file %s: %v", filename, err)
		http.Error(w, "Failed to delete video file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	ensureJSONResponse(w, map[string]string{"message": "Video deleted successfully", "filename": filename}, http.StatusOK)
}

// handleDelRead 删除小说文件
func handleDelRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	filename := r.PathValue("filename")
	if filename == "" {
		http.Error(w, "Filename is required", http.StatusBadRequest)
		return
	}
	read := domain.Read{}
	err := read.Remove(filename)
	if err != nil {
		log.Printf("Error deleting read file %s: %v", filename, err)
		http.Error(w, "Failed to delete read file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	ensureJSONResponse(w, map[string]string{"message": "Read deleted successfully", "filename": filename}, http.StatusOK)
}
