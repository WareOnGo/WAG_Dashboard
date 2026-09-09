# Visit Itinerary Generator

Create editable visit notes for a selected set of warehouses, including their address,
space, docks, specifications, contact details, and location link. The tool resolves the
warehouse IDs you submit and asks for one contact-reveal reason for the whole itinerary.

## How to use

1. Open **Itinerary** from the desktop header or the mobile navigation drawer. This opens
   an inline ID input; opening it does not fetch warehouse records.
2. Enter comma-separated numeric warehouse IDs, for example `5, 12, 27`, in visit order.
3. Select **Generate** or press Enter. The app loads only those warehouses and preserves
   your input order for the records it finds.
4. Enter the deal or site-visit reason when prompted. The reason must contain 3–280
   characters after trimming. Confirming requests each found warehouse's contact number
   with that same reason; cancelling makes no contact-number requests.
5. In **Visit Itinerary**, optionally select **Hide owner detail** and/or **Hide rent**,
   then edit the generated text. Changing either checkbox rebuilds the text and resets
   manual edits, so set these options first.
6. Select **Copy** to copy the current text, including any manual edits, for sharing.

Each new generation starts with owner details and rent visible. Hiding owner details
changes the generated output; the contact-reveal requests have already taken place under
the supplied reason. Closing the result keeps the ID input available for another generation.

## Output

An illustrative entry with a contact number unavailable:

```text
1. WH-5 - Example Owner (N/A)
   Address: Example Industrial Estate, Bangalore, Karnataka, 560001
   Total Space: 75000 + 25000 sq ft
   Docks: 6
  Compliances: Fire NOC
  Other Specs: Loading yard
  Rate: 22
   Location: https://maps.google.com/?q=12.9716,77.5946
```

Areas are joined with ` + ` when `totalSpaceSqft` is an array. The rate is rendered as
stored, without adding a currency symbol or units. **Hide owner detail** reduces the
first line to the numbered warehouse ID; **Hide rent** removes the rate line.

## Loading and errors

- Empty input or input with no parsable IDs shows a warning before any warehouse lookup.
- If no requested warehouse is found, generation stops before the reason prompt.
- If some IDs are missing, the itinerary contains the found records and shows a missing-ID
  count after generation.
- Contact requests are independent. If one fails, its entry uses any contact number on the
  warehouse record, or `N/A`; other successful reveals remain available.
- A warehouse lookup failure shows an error. Copying also reports success or failure from
  the browser clipboard API.

## Implementation

| Responsibility | Source |
|---|---|
| ID input, generation, editable result, and copy action | [`MobileHeader.jsx`](src/components/MobileHeader.jsx) |
| Mobile drawer entry | [`MobileNavigation.jsx`](src/components/MobileNavigation.jsx) |
| Shared tool open/closed state | [`MobileToolsContext.jsx`](src/contexts/MobileToolsContext.jsx) |
| Reason prompt and bounds | [`RevealReasonModal.jsx`](src/components/RevealReasonModal.jsx), [`revealReason.js`](src/utils/revealReason.js) |
| Warehouse and contact requests | [`warehouseService.js`](src/services/warehouseService.js) |

`warehouseService.getByIds(ids)` requests `/warehouses` with `ids`, `all=true`, and
`includeImageLabels=true`, then unwraps the response envelope. It does not load the full
warehouse catalogue through `getAll()`.

After reason confirmation, `getContactNumber(id, reason)` calls
`/warehouses/:id/contact-number` once for each found entry. The backend validates and
audits these reveals. Resolved records and numbers are held in the header's local state
so display options can rebuild the current result without another request; a new
generation performs a new lookup.

See the [main README](README.md) for authentication, API configuration, and other exports.
