# User Roles & Permission Matrix

| Capability | Customer | Waiter | Cashier | Kitchen | Admin | Owner |
|---|---:|---:|---:|---:|---:|---:|
| Browse menu | Yes | Yes | Yes | Limited | Yes | Yes |
| Create order | Yes | Yes | Yes | No | Yes | Yes |
| View own order | Yes | Yes | Yes | Yes | Yes | Yes |
| Confirm order | No | No | Yes | No | Yes | Yes |
| Prepare order | No | No | No | Yes | Yes | Yes |
| Mark ready | No | No | No | Yes | Yes | Yes |
| Mark served | No | Yes | Yes | No | Yes | Yes |
| Record payment | No | No | Yes | No | Yes | Yes |
| Manage menu | No | No | No | No | Yes | Yes |
| Manage tables | No | No | No | No | Yes | Yes |
| Reports | No | Limited | Yes | Limited | Yes | Yes |

## Principle
Permission must be enforced by backend/API, not only by hiding buttons in the UI.
