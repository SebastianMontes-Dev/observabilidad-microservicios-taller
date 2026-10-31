package com.ejemplo.productos.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/productos")
public class ProductoController {

    private static final Logger log = LoggerFactory.getLogger(ProductoController.class);

    @GetMapping("/{id}")
    public Map<String, Object> obtener(@PathVariable Long id) {

        log.info("Consultando producto con ID {}", id);
        return Map.of("id", id, "nombre", "Computador portatil", "precio", 2500000);
    }
}
