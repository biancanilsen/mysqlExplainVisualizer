export const jsonExample = {
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "12781.93"
    },
    "nested_loop": [
      {
        "table": {
          "table_name": "c",
          "access_type": "ALL",
          "possible_keys": [
            "PRIMARY"
          ],
          "rows_examined_per_scan": 1500,
          "rows_produced_per_join": 150,
          "filtered": "10.00",
          "cost_info": {
            "read_cost": "268.35",
            "eval_cost": "150.00",
            "prefix_cost": "418.35",
            "data_read_per_join": "70K"
          },
          "used_columns": [
            "id",
            "nome"
          ]
        }
      },
      {
        "table": {
          "table_name": "p",
          "access_type": "ref",
          "possible_keys": [
            "fk_pedidos_clientes"
          ],
          "key": "fk_pedidos_clientes",
          "used_key_parts": [
            "id_cliente"
          ],
          "key_length": "4",
          "ref": [
            "ecommerce_db.c.id"
          ],
          "rows_examined_per_scan": 4,
          "rows_produced_per_join": 600,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "600.00",
            "eval_cost": "120.00",
            "prefix_cost": "1138.35",
            "data_read_per_join": "18K"
          },
          "used_columns": [
            "id",
            "id_cliente"
          ]
        }
      },
      {
        "table": {
          "table_name": "i",
          "access_type": "ref",
          "possible_keys": [
            "fk_itens_pedido"
          ],
          "key": "fk_itens_pedido",
          "used_key_parts": [
            "id_pedido"
          ],
          "key_length": "4",
          "ref": [
            "ecommerce_db.p.id"
          ],
          "rows_examined_per_scan": 2,
          "rows_produced_per_join": 1200,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "9843.58",
            "eval_cost": "1200.00",
            "prefix_cost": "12181.93",
            "data_read_per_join": "75K"
          },
          "used_columns": [
            "id_pedido",
            "id_produto"
          ]
        }
      },
      {
        "table": {
          "table_name": "prod",
          "access_type": "eq_ref",
          "possible_keys": [
            "PRIMARY"
          ],
          "key": "PRIMARY",
          "used_key_parts": [
            "id"
          ],
          "key_length": "4",
          "ref": [
            "ecommerce_db.i.id_produto"
          ],
          "rows_examined_per_scan": 1,
          "rows_produced_per_join": 1200,
          "filtered": "100.00",
          "cost_info": {
            "read_cost": "600.00",
            "eval_cost": "240.00",
            "prefix_cost": "12781.93",
            "data_read_per_join": "450K"
          },
          "used_columns": [
            "id",
            "nome_produto",
            "preco"
          ]
        }
      }
    ]
  }
}