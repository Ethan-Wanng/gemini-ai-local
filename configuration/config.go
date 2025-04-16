package configuration

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
	"net/http"
	"os"
	"strings"
	"time"
)

var (
	Fs                 *embed.FS
	EnvMap             map[string]string
	HttpClientWithPort *http.Client
	HttpClientWithout  = http.DefaultClient
	CurrentClient      *http.Client
	AIApi              string
	DbPath             = "./history/persistence.db"
	DB                 *sql.DB
	DefaultModelInt    = "gemini-2.0-flash"
	HttpState          = 200
	GeminiApiKey       = ""
)

// CustomMIMEs - A set of commonly encountered MIME types.
var CustomMIMEs = map[string]struct{}{
	"application/pdf":          {},
	"application/x-javascript": {},
	"application/x-python":     {},
	"text/plain":               {},
	"text/html":                {},
	"text/css":                 {},
	"image/jpeg":               {},
	"image/webp":               {},
	"image/heic":               {},
	"image/heif":               {},
	"video/mp4":                {},
	"video/mpeg":               {},
	"video/mov":                {},
	"video/avi":                {},
	"video/x-flv":              {},
	"video/mpg":                {},
	"video/webm":               {},
	"video/wmv":                {},
	"video/3gpp":               {},
	"audio/wav":                {},
	"audio/mp3":                {},
	"audio/mpeg":               {},
	"audio/aiff":               {},
	"audio/aac":                {},
	"audio/ogg":                {},
	"audio/flac":               {},
	"application/msword":       {},
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": {},
	"application/vnd.ms-excel": {},
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         {},
	"application/vnd.ms-powerpoint":                                             {},
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": {},
	"application/zip":              {},
	"application/x-zip-compressed": {},
	"application/vnd.rar":          {},
	"application/x-rar-compressed": {},
	"application/x-7z-compressed":  {},
	"application/x-tar":            {},
	"application/gzip":             {},
	"application/json":             {},
	"image/gif":                    {},
	"image/svg+xml":                {},
	"image/bmp":                    {},
	"image/vnd.microsoft.icon":     {},
	"image/x-icon":                 {},
	"audio/mp4":                    {},
	"audio/x-m4a":                  {},
	"audio/x-ms-wma":               {},
	"video/quicktime":              {},
	"text/javascript":              {},
	"text/x-python":                {},
	"application/xml":              {},
	"application/rtf":              {},
	"text/markdown":                {},
	"application/x-yaml":           {},
	"text/yaml":                    {},
	"font/ttf":                     {},
	"font/woff":                    {},
	"font/woff2":                   {},
}

type UserInput struct {
	Message   string           `json:"message,omitempty"`
	SessionID int              `json:"session_id"`
	Files     []*InlineDataDto `json:"files,omitempty"`
	ContentID *int             `json:"content_id,omitempty"`
	IsReply   bool             `json:"is_reply,omitempty"`
}

type InlineDataDto struct {
	MimeType string `json:"mimeType"`
	Data     []byte `json:"data"`
}

const (
	busyTimeout     = 5000
	maxOpenConns    = 100
	maxIdleConns    = 20
	connMaxIdleTime = 5 * time.Minute
	connMaxLifetime = 1 * time.Hour
	historyDirName  = "history"
	historyDirPerm  = 0755
)

func InitializeDBPool(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", fmt.Sprintf("%s?_busy_timeout=%d", dbPath, busyTimeout))
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	DB.SetMaxOpenConns(maxOpenConns)
	DB.SetMaxIdleConns(maxIdleConns)
	DB.SetConnMaxIdleTime(connMaxIdleTime)
	DB.SetConnMaxLifetime(connMaxLifetime)

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to verify database connection: %w", err)
	}

	if _, err = DB.Exec("PRAGMA journal_mode = WAL;"); err != nil {
		return fmt.Errorf("failed to set WAL mode: %w", err)
	}
	return nil
}

func InitHistoryDir() error {
	if err := os.MkdirAll(historyDirName, historyDirPerm); err != nil {
		return fmt.Errorf("failed to create history directory: %w", err)
	}

	db, err := sql.Open("sqlite3", DbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	tables := []struct {
		name string
		stmt string
	}{
		{
			"key",
			`CREATE TABLE IF NOT EXISTS key (
    			id INTEGER PRIMARY KEY AUTOINCREMENT,
    			encrypted_value TEXT NOT NULL
			);`,
		},
		{
			"session",
			`CREATE TABLE IF NOT EXISTS session (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                session_base TEXT NOT NULL,
                create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                update_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
		},
		{
			"content",
			`CREATE TABLE IF NOT EXISTS content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                role TEXT NOT NULL
            );`,
		},
		{
			"part",
			`CREATE TABLE IF NOT EXISTS part (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inline_data_id INTEGER,
                content_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
		},
		{
			"inline_data",
			`CREATE TABLE IF NOT EXISTS inline_data (
    			id INTEGER PRIMARY KEY AUTOINCREMENT,
    			part_id INTEGER NOT NULL,
    			media_type TEXT NOT NULL,
    			data BLOB NOT NULL
            );`,
		},
	}

	for _, table := range tables {
		if _, err := db.Exec(table.stmt); err != nil {
			return fmt.Errorf("failed to create %s table: %w", table.name, err)
		}
	}

	return nil
}

// BuildAIApi 构建AI接口
func BuildAIApi(DefaultModel, ContentType string) string {
	if GeminiApiKey == "" {
		row := DB.QueryRow("SELECT encrypted_value FROM key where id = 1")
		err := row.Scan(&GeminiApiKey)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				GeminiApiKey = EnvMap["GEMINI_API_KEY"]
			}
		}
	}
	GeminiBaseURL := EnvMap["BASE_GOOGLE_AI"]
	modelMap := map[string]string{
		"gemini-1.5-flash":              EnvMap["GEMINI_MODEL_1.5"],
		"gemini-1.5-pro":                EnvMap["GEMINI_MODEL_1.5_PRO"],
		"gemini-2.0-flash":              EnvMap["GEMINI_MODEL_2.0"],
		"gemini-2.0-flash-exp":          EnvMap["GEMINI_MODEL_2_EXP"],
		"gemini-2.0-flash-thinking-exp": EnvMap["GEMINI_MODEL_2.0_Thinking"],
		"gemini-2.5-pro":                EnvMap["GEMINI_MODEL_2.5_PRO"],
		"gemini-2.0-pro":                EnvMap["GEMINI_MODEL_2.0_PRO"],
		"gemini-exp-1206":               EnvMap["GEMINI_MODEL_1206"],
	}

	if DefaultModel == "" {
		if model, ok := modelMap[DefaultModelInt]; ok {
			DefaultModel = model
		}
	} else {
		if model, ok := modelMap[DefaultModel]; ok {
			DefaultModel = model
			DefaultModelInt = DefaultModel
		}
	}

	if ContentType == "" && DefaultModelInt != EnvMap["GEMINI_MODEL_2_EXP"] {
		ContentType = EnvMap["CONTENT_TYPE_STEAM"]
	} else if DefaultModelInt == EnvMap["GEMINI_MODEL_2_EXP"] {
		ContentType = EnvMap["CONTENT_TYPE_JSON"]
	}

	return fmt.Sprintf("%s%s:%skey=%s", GeminiBaseURL, DefaultModel, ContentType, GeminiApiKey)
}

func VerifyGoogleAccess() error {
	testURL := "https://youtube.com"
	timeout := 3 * time.Second

	clientWithPort := *HttpClientWithPort
	clientWithPort.Timeout = timeout
	clientWithout := *HttpClientWithout
	clientWithout.Timeout = timeout

	withPortResp, withPortErr := clientWithPort.Get(testURL)
	withoutResp, withoutErr := clientWithout.Get(testURL)
	withPortOK := withPortErr == nil && withPortResp != nil && withPortResp.StatusCode == http.StatusOK
	withoutOK := withoutErr == nil && withoutResp != nil && withoutResp.StatusCode == http.StatusOK

	if withPortResp != nil {
		withPortResp.Body.Close()
	}
	if withoutResp != nil {
		withoutResp.Body.Close()
	}

	if withoutOK {
		CurrentClient = HttpClientWithout
		return nil
	}

	if withPortOK {
		CurrentClient = HttpClientWithPort
		return nil
	}

	if CurrentClient == nil {
		return fmt.Errorf("Gemini API not initialized")
	}
	return nil
}

// GetKey 检查history目录中是否存在example后缀的文件，如果有检查是否有存在gemini-key前缀的文本，然后提取文本，将这个文本赋值GeminiApiKey
func GetKey() bool {
	entries, err := os.ReadDir(historyDirName)
	if err != nil {
		return false
	}

	for _, entry := range entries {
		if !entry.IsDir() && len(entry.Name()) > 8 && entry.Name()[len(entry.Name())-8:] == ".example" {
			content, err := os.ReadFile(fmt.Sprintf("%s/%s", historyDirName, entry.Name()))
			if err != nil {
				continue
			}

			text := string(content)
			const prefix = "gemini-key:"
			if idx := strings.Index(text, prefix); idx != -1 {
				// Extract the key value after the prefix
				keyStart := idx + len(prefix)
				keyEnd := strings.IndexAny(text[keyStart:], "\r\n")
				if keyEnd == -1 {
					keyEnd = len(text)
				} else {
					keyEnd += keyStart
				}

				key := strings.TrimSpace(text[keyStart:keyEnd])
				if key != "" {
					GeminiApiKey = key
					return true
				}
			}
		}
	}

	return false
}
