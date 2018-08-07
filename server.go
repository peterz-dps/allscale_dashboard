package main

import (
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// ----------------------------------------------------------------- Web Server

var upgrader = websocket.Upgrader{}

func status(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade:", err)
		return
	}
	defer c.Close()

	for {
		c.WriteJSON(randMessage())
		time.Sleep(1 * time.Second)
	}
}

func main() {
	http.HandleFunc("/status", status)

	fs := http.FileServer(http.Dir("web"))
	http.Handle("/", fs)

	log.Fatal(http.ListenAndServe("localhost:8080", nil))
}

// ---------------------------------------------------------- Message Generator

const numNodes = 5

type message struct {
	Type    string
	Payload interface{}
}

type loadStatus struct {
	Node int64
	Load int64
}

func randMessage() message {
	return message{
		"LoadStatus",
		loadStatus{
			int64(rand.Intn(numNodes) + 1),
			int64(rand.Intn(101)),
		},
	}
}
