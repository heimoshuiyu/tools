package main

import (
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/dustin/go-humanize"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type File struct {
	Path       string `gorm:"primaryKey"`
	Filesize   int64  `gorm:"not null"`
	Converting bool   `gorm:"not null;default:false"`
	Done       bool   `gorm:"not null;default:false"`
	gorm.DeletedAt
}

var filetypes map[string]bool = map[string]bool{
	".mp4":  true,
	".avi":  true,
	".flv":  true,
	".mpeg": true,
	".wmv":  true,
}

var db *gorm.DB

func init() {
	var err error
	log.Println("Starting")
	//db, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db, err = gorm.Open(sqlite.Open("./files.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	db.AutoMigrate(&File{})
}

func walk() {

	root := "."
	if len(os.Args) > 2 {
		root = os.Args[2]
	}
	log.Println("Walking directory", root)
	files := make([]File, 0)
	var total int64 // total size
	filepath.Walk(root, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		ext := filepath.Ext(path)
		_, ok := filetypes[ext]
		if !ok {
			return nil
		}
		files = append(files, File{
			Path:     path,
			Filesize: info.Size(),
		})
		total += info.Size()
		log.Println("Adding", path)
		return nil
	})
	result := db.CreateInBatches(&files, 1000)
	if result.Error != nil {
		log.Fatal(result.Error)
	}
	log.Println("Walk", result.RowsAffected, "files. Total size", humanize.Bytes(uint64(total)))
}

func del() {
	var total int64
	log.Println("Deleting...")
	files := make([]File, 0)
	result := db.Model(&File{}).Where("done = true").Find(&files)
	if result.Error != nil {
		log.Fatal(result.Error)
	}
	for _, file := range files {
		log.Println(file.Path)
		log.Println("Removing", file.Path)
		err := os.Remove(file.Path)
		if err != nil {
			log.Println("Error deleting file", file.Path, err)
		}
		result = db.Delete(&file)
		if result.Error != nil {
			log.Println("Error deleting record", result.Error, file.Path)
		}
		total += file.Filesize
	}
	log.Println("Delete done, total ", humanize.Bytes(uint64(total)))
}

func clean() {
	result := db.Model(&File{}).Where("converting = true").Update("converting", false)
	if result.Error != nil {
		log.Fatal(result.Error)
	}
	log.Println("clean", result.RowsAffected, "rows")
}

func ffmpeg(filename string) error {
	cmd := exec.Command("ffmpeg", "-i", filename,
		"-c:v", "libsvtav1", "-crf", "39",
		"-vf", "scale='min(1280,iw)':'min(720,ih)'",
		"-c:a", "libopus", "-ab", "64k", "-y", filename+".mkv")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	return err
}

func stats() {
	var totalFilesize int64
	result := db.Model(&File{}).Select("sum(filesize)").Scan(&totalFilesize)
	if result.Error != nil {
		log.Fatal(result.Error)
	}
	var totalFileNums int64
	result = db.Model(&File{}).Count(&totalFileNums)
	if result.Error != nil {
		log.Fatal(result.Error)
	}
	log.Println("Total file size:", humanize.Bytes(uint64(totalFilesize)), "nums:", totalFileNums)

	var convertingFilesize int64
	result = db.Model(&File{}).Where("done = false and converting = true").Select("sum(filesize)").Scan(&convertingFilesize)
	var convertingFileNums int64
	result = db.Model(&File{}).Where("done = false and converting = true").Count(&convertingFileNums)
	log.Println("Converting file size:", humanize.Bytes(uint64(convertingFilesize)), "nums:", convertingFileNums)

	var doneFileNums int64
	result = db.Model(&File{}).Where("done = true").Count(&doneFileNums)
	var doneFilesize int64
	result = db.Model(&File{}).Where("done = true").Select("sum(filesize)").Scan(&doneFilesize)
	log.Println("Done filesize:", humanize.Bytes(uint64(doneFilesize)), "nums:", doneFileNums)
}

func main() {
	if len(os.Args) > 1 {
		command := os.Args[1]
		if command == "walk" {
			walk()
		} else if command == "delete" {
			del()
		} else if command == "clean" {
			clean()
		} else if command == "stats" || command == "status" {
			stats()
		} else {
			log.Fatal("Unknown command", command)
		}
		return
	}
	for {
		// random select one
		file := File{}
		result := db.Where("done = false and converting = false").Order("random()").Take(&file)
		if result.Error != nil {
			break
		}
		log.Println(file)
		// mark converting true
		result = db.Model(&file).Where("converting = false").Update("converting", true)
		if result.Error != nil {
			log.Fatal(result.Error)
		}
		err := ffmpeg(file.Path)
		if err != nil {
			log.Println(err)
			continue
		}
		// mark done
		result = db.Model(&file).Update("done", true)
		if result.Error != nil {
			log.Fatal(result.Error)
		}
	}
}
