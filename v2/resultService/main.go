package main
import (
	"net/http"
	"sync"
	"github.com/gin-gonic/gin"
)
func main(){
	router := gin.Default()
	router.GET("/", rootLevel)
	router.Run()
}
func rootLevel(c *gin.Context){
	c.IndentedJSON(http.StatusOK, gin.H{"message" : "Running"})
}
