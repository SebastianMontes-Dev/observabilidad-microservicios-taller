package com.ejemplo.pedidos.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import java.util.Map;

@RestController
@RequestMapping("/pedidos")
public class PedidoController {

    private static final Logger log = LoggerFactory.getLogger(PedidoController.class);
    private final RestClient restClient;

    public PedidoController(RestClient restClient) {
        this.restClient = restClient;
    }

    @GetMapping("/{id}")
    public Map<String, Object> consultar(@PathVariable Long id) {

        log.info("Iniciando consulta del pedido {}", id);
        Map<?, ?> producto = restClient.get()
                .uri("http://localhost:8081/productos/{id}", id)
                .retrieve()
                .body(Map.class);
        log.info("Consulta del producto finalizada para pedido {}", id);
        return Map.of("pedidoId", id, "estado", "PROCESADO", "producto", producto);
    }
}
