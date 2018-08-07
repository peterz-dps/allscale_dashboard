package main

import (
	"encoding/binary"
	"io"
	"log"
	"net"
	"net/http"

	"github.com/dustin/go-broadcast"
	"github.com/gorilla/websocket"
)

var broadcaster = broadcast.NewBroadcaster(100)

// ----------------------------------------------------------------------- Main

func main() {
	go listenAndServeTCP()
	listenAndServeHTTP()
}

// ----------------------------------------------------------------- TCP Server

func listenAndServeTCP() {
	l, err := net.Listen("tcp", ":1337")
	if err != nil {
		log.Panicln(err)
	}
	log.Println("Listening for TCP connections")
	defer l.Close()

	for {
		conn, err := l.Accept()
		if err != nil {
			log.Panicln(err)
		}

		go handleTCPRequest(conn)
	}
}

func handleTCPRequest(conn net.Conn) {
	log.Println("Accepted new TCP connection.")
	defer conn.Close()
	defer log.Println("Closed TCP connection.")

	for {
		var size uint64
		err := binary.Read(conn, binary.BigEndian, &size)
		if err != nil {
			log.Println("read size:", err)
			break
		}

		log.Println("required length:", size)

		msg := make([]byte, size)
		_, err = io.ReadFull(conn, msg)
		if err != nil {
			log.Println("read msg:", err)
			break
		}

		log.Println("Message:", string(msg))
		broadcaster.Submit(msg)
	}
}

// ----------------------------------------------------------------- Web Server

var upgrader = websocket.Upgrader{}

func status(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade:", err)
		return
	}
	defer c.Close()

	ch := make(chan interface{})
	broadcaster.Register(ch)
	defer broadcaster.Unregister(ch)

	for msg := range ch {
		m, ok := msg.([]byte)
		if !ok {
			log.Println("invalid type")
			continue
		}

		log.Println("sending:", m)
		c.WriteMessage(websocket.TextMessage, m)
	}
}

func listenAndServeHTTP() {
	http.HandleFunc("/status", status)
	fs := http.FileServer(http.Dir("web"))
	http.Handle("/", fs)
	log.Fatal(http.ListenAndServe("localhost:8080", nil))
}
