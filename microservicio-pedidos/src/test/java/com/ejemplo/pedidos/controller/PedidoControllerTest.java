package com.ejemplo.pedidos.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PedidoController.class)
@Import(PedidoControllerTest.ClienteSimulado.class)
class PedidoControllerTest {

    /** Sustituye el cliente real por uno ligado a un servidor simulado de productos. */
    @TestConfiguration
    static class ClienteSimulado {

        private final RestClient.Builder builder = RestClient.builder();

        @Bean
        MockRestServiceServer productosSimulado() {
            return MockRestServiceServer.bindTo(builder).build();
        }

        @Bean
        RestClient restClient(MockRestServiceServer productosSimulado) {
            return builder.build();
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MockRestServiceServer productos;

    @Test
    void consultarAnidaElProductoDelOtroServicio() throws Exception {
        productos.expect(requestTo("http://localhost:8081/productos/1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(
                        "{\"id\":1,\"nombre\":\"Computador portatil\",\"precio\":2500000}",
                        MediaType.APPLICATION_JSON));

        mockMvc.perform(get("/pedidos/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pedidoId").value(1))
                .andExpect(jsonPath("$.estado").value("PROCESADO"))
                .andExpect(jsonPath("$.producto.nombre").value("Computador portatil"));
    }

    @Test
    void consultarFallaCuandoProductosResponde500() throws Exception {
        productos.expect(requestTo("http://localhost:8081/productos/1"))
                .andRespond(withServerError());

        // Sin manejo de errores en el controlador, MockMvc propaga la excepción del cliente
        // (en la aplicación real Spring Boot la convierte en un HTTP 500).
        assertThatThrownBy(() -> mockMvc.perform(get("/pedidos/1")))
                .hasRootCauseInstanceOf(HttpServerErrorException.class);
    }
}
