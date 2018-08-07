package main

import (
	"encoding/binary"
	"encoding/json"
	"flag"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/dustin/go-broadcast"
	"github.com/gorilla/websocket"
)

var broadcaster = broadcast.NewBroadcaster(100)

// ----------------------------------------------------------------------- Main

func main() {
	tcpPort := flag.Int("tcp-port", 1337, "port for the TCP listener")
	httpPort := flag.Int("http-port", 8080, "port for the HTTP listener")
	msgGen := flag.Bool("msg-gen", false, "generate random messages")
	flag.Parse()

	if *msgGen {
		go messageGenerator()
	}

	go listenAndServeTCP(*tcpPort)
	listenAndServeHTTP(*httpPort)
}

// ----------------------------------------------------------------- TCP Server

func listenAndServeTCP(port int) {
	log.Println("Starting TCP listener on", port)

	l, err := net.Listen("tcp", ":"+strconv.Itoa(port))
	if err != nil {
		log.Panicln(err)
	}
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
	log.Println("TCP: Accepted new connection")
	defer conn.Close()
	defer log.Println("TCP: Closing connection")

	for {
		var size uint64
		err := binary.Read(conn, binary.BigEndian, &size)
		if err != nil {
			log.Println("TCP:", conn, ":", "read size:", err)
			break
		}

		msg := make([]byte, size)
		_, err = io.ReadFull(conn, msg)
		if err != nil {
			log.Println("TCP:", conn, ":", "read message:", err)
			break
		}

		log.Println("TCP:", conn, ":", "successfully read message")

		broadcaster.Submit(msg)
	}
}

// ----------------------------------------------------------------- Web Server

var upgrader = websocket.Upgrader{}

func status(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WS: upgrade:", err)
		return
	}

	log.Println("WS: Accepted new connection")
	defer c.Close()
	defer log.Println("WS: Closing connection")

	ch := make(chan interface{})
	broadcaster.Register(ch)
	defer broadcaster.Unregister(ch)

	for msg := range ch {

		m, ok := msg.([]byte)
		if !ok {
			log.Println("WS: Invalid type for message")
			continue
		}

		if c.WriteMessage(websocket.TextMessage, m) != nil {
			break
		}
	}
}

func listenAndServeHTTP(port int) {
	log.Println("Starting HTTP listener on", port)

	http.HandleFunc("/status", status)
	fs := http.FileServer(http.Dir("web"))
	http.Handle("/", fs)
	http.ListenAndServe("localhost:"+strconv.Itoa(port), nil)
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

func messageGenerator() {
	log.Println("Starting Random Message Generator")

	for {
		msg := message{
			"LoadStatus",
			loadStatus{
				int64(rand.Intn(numNodes) + 1),
				int64(rand.Intn(101)),
			},
		}

		data, err := json.Marshal(msg)
		if err != nil {
			log.Println("RMG: Could not marshal message:", err)
			break
		}

		broadcaster.Submit(data)

		time.Sleep(1 * time.Second)
	}
}
