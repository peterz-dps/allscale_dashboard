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
	"sync"
	"time"

	"github.com/dustin/go-broadcast"
	"github.com/gorilla/websocket"
)

var tcpToWsBroadcast = broadcast.NewBroadcaster(100)
var wsToTcpBroadcast = broadcast.NewBroadcaster(100)

// ----------------------------------------------------------------------- Main

func main() {
	tcpPort := flag.Int("tcp-port", 1337, "port for the TCP listener")
	httpPort := flag.Int("http-port", 8080, "port for the HTTP listener")
	msgGen := flag.Bool("msg-gen", false, "generate random messages")
	msgGenIv := flag.Int("msg-gen-interval", 1000, "message generator interval [ms]")
	flag.Parse()

	if *msgGen {
		interval := time.Duration(*msgGenIv) * time.Millisecond
		go messageGenerator(interval)
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

	var wg sync.WaitGroup
	wg.Add(2)

	go handleTCPRequestRead(&wg, conn)
	go handleTCPRequestWrite(&wg, conn)

	wg.Wait()
}

func handleTCPRequestRead(wg *sync.WaitGroup, conn net.Conn) {
	defer wg.Done()

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

		tcpToWsBroadcast.Submit(msg)
	}
}

func handleTCPRequestWrite(wg *sync.WaitGroup, conn net.Conn) {
	defer wg.Done()

	ch := make(chan interface{})
	wsToTcpBroadcast.Register(ch)
	defer wsToTcpBroadcast.Unregister(ch)

	for msg := range ch {
		m, ok := msg.([]byte)
		if !ok {
			log.Println("TCP: Invalid type for message")
			continue
		}

		log.Printf("len(m): %#+v\n", len(m))
		err := binary.Write(conn, binary.BigEndian, int64(len(m)))
		if err != nil {
			log.Println("err write")
			break
		}

		_, err = conn.Write(m)
		if err != nil {
			log.Println("err write 2")
			break
		}
	}
}

// ----------------------------------------------------------------- Web Server

var upgrader = websocket.Upgrader{}

func handleWs(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WS: upgrade:", err)
		return
	}

	log.Println("WS: Accepted new connection")
	defer c.Close()
	defer log.Println("WS: Closing connection")

	var wg sync.WaitGroup
	wg.Add(2)

	go handleWsWrite(&wg, c)
	go handleWsRead(&wg, c)

	wg.Wait()
}

func handleWsWrite(wg *sync.WaitGroup, conn *websocket.Conn) {
	defer wg.Done()

	ch := make(chan interface{})
	tcpToWsBroadcast.Register(ch)
	defer tcpToWsBroadcast.Unregister(ch)

	for msg := range ch {
		m, ok := msg.([]byte)
		if !ok {
			log.Println("WS: Invalid type for message")
			continue
		}

		if conn.WriteMessage(websocket.TextMessage, m) != nil {
			break
		}
	}
}

func handleWsRead(wg *sync.WaitGroup, conn *websocket.Conn) {
	defer wg.Done()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		wsToTcpBroadcast.Submit(msg)
	}
}

func listenAndServeHTTP(port int) {
	log.Println("Starting HTTP listener on", port)

	http.HandleFunc("/ws", handleWs)
	fs := http.FileServer(http.Dir("web"))
	http.Handle("/", fs)
	http.ListenAndServe(":"+strconv.Itoa(port), nil)
}

// ---------------------------------------------------------- Message Generator

const (
	numNodes          = 16
	memLimit          = 100000
	maxTaskThroughput = 100
	networkLimit      = 100000
)

var timeStep int64 = 1

type statusUpdate struct {
	Time  int64              `json:"time"`
	Type  string             `json:"type"`
	Nodes []nodeStatusUpdate `json:"nodes"`
}

type nodeStatusUpdate struct {
	ID                    int64         `json:"id"`
	State                 string        `json:"state"`
	CPULoad               float64       `json:"cpu_load"`
	MemLoad               int64         `json:"mem_load"`
	TotalMemory           int64         `json:"total_memory"`
	TaskThroughput        int64         `json:"task_throughput"`
	WeightedTaskThrougput float64       `json:"weighted_task_througput"`
	NetworkIn             int64         `json:"network_in"`
	NetworkOut            int64         `json:"network_out"`
	IdleRate              float64       `json:"idle_rate"`
	OwnedData             []interface{} `json:"owned_data"`
}

func randNodeStatusUpdate(id int64) nodeStatusUpdate {
	return nodeStatusUpdate{
		ID:                    id,
		State:                 "online",
		CPULoad:               rand.Float64(),
		MemLoad:               int64(rand.Intn(memLimit)),
		TotalMemory:           memLimit * 1.2,
		TaskThroughput:        int64(rand.Intn(maxTaskThroughput)),
		WeightedTaskThrougput: rand.Float64() * 10,
		NetworkIn:             int64(rand.Intn(networkLimit)),
		NetworkOut:            int64(rand.Intn(networkLimit)),
		IdleRate:              rand.Float64(),
		OwnedData:             make([]interface{}, 0),
	}
}

func messageGenerator(updateInterval time.Duration) {
	log.Println("Starting Random Message Generator")

	for {
		var nodes []nodeStatusUpdate
		for id := int64(0); id < numNodes; id++ {
			nodes = append(nodes, randNodeStatusUpdate(id))
		}

		if timeStep%20 > 10 {
			nodes[7].State = "offline"
			nodes[11].State = "offline"
		}

		msg := statusUpdate{
			Time:  timeStep,
			Type:  "status",
			Nodes: nodes,
		}

		data, err := json.Marshal(msg)
		if err != nil {
			log.Println("RMG: Could not marshal message:", err)
			break
		}

		tcpToWsBroadcast.Submit(data)

		timeStep++

		time.Sleep(updateInterval)
	}
}
