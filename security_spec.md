# Security Specification - 工程保固管理系統

## 1. Data Invariants
- A warranty record must have a project name.
- Expiry date must be a valid timestamp.
- Deposit must be a non-negative number.
- `createdAt` and `updatedAt` should be server-assigned.

## 2. The "Dirty Dozen" Payloads (Target: /warranties/{id})

1. **Identity Spoofing**: Attempt to create a document with an ID containing malicious characters (e.g., `../../etc/passwd`).
2. **Schema Break**: Create a warranty without `projectName`.
3. **Type Poisoning**: Send `deposit` as a string (`"1000"`).
4. **Shadow Field**: Add a `isVerified: true` field to the payload.
5. **Resource Exhaustion**: Send a `projectName` that is 2MB in size.
6. **Immutability Breach**: Update an existing warranty and try to change its `createdAt` time.
7. **Temporal Fraud**: Create a warranty with a `createdAt` in the future (client-side provided).
8. **Negative Value**: Create a warranty with a negative `deposit` (`-500`).
9. **Path Poisoning**: Target an ID that is 2000 characters long.
10. **State Shortcut**: (N/A for this simple app, but for stateful apps: set status to 'finished' without owner check).
11. **PII Leak**: (N/A here, but: query all users' private emails).
12. **Unauthorized Update**: Update a field not allowed by the schema.

## 3. Anticipated Rule Behavior
- `isValidId(warrantyId)` will block payloads 1 and 9.
- `isValidWarranty(incoming())` will block payloads 2, 3, 4, 5, 8.
- `incoming().createdAt == request.time` will block payload 7.
- `incoming().createdAt == existing().createdAt` will block payload 6.
- `affectedKeys().hasOnly(...)` would block payload 4 and 12.
