export const spec1 = {
  designEntityId: "YFCyp7zEYpOhkiU2y1XW6",
  id: "Spec_000",
  version: "1",
  revision: "0",
  serviceType: "RFS",
  lifecycleStatus: "inDesign",
  "@type": "ServiceSpecification",
  audit: {
    projectId: "9oA1uhJgO2roi0mXtZgWL",
    projectName: "qefsd",
    createdBy: "unknownPrincipal",
    createdAt: "2025-07-22T10:02:15.39868927+02:00",
    changedBy: "unknownPrincipal",
    changedAt: "2025-07-22T10:02:15.398724366+02:00",
  },
  meta: {
    changeType: "new",
  },
  category: [
    {
      id: "project1_category",
      version: "1",
      "@baseType": "Reference",
      "@type": "ServiceCategoryRef",
    },
  ],
  targetEntitySchema: {
    type: "object",
    properties: {
      first_name: {
        type: "string",
      },
      last_name: {
        type: "string",
      },
      birthday: {
        type: "string",
        format: "date",
      },
      address: {
        type: "object",
        properties: {
          street_address: {
            type: "string",
          },
          city: {
            type: "string",
          },
          state: {
            type: "string",
          },
          country: {
            type: "string",
          },
        },
      },
    },
  },
  serviceSpecRelationship: [
    {
      id: "TEST_1",
      associationSpec: {
        id: "TEST_1",
        version: "1",
        "@baseType": "Reference",
        "@type": "ServiceSpecificationRef",
      },
      relationshipType: "parent",
      "@baseType": "Relationship",
      "@type": "ServiceSpecificationRelationship",
    },
  ],
  supportingServiceSpecification: [],
  "@baseType": "Specification",
}

export const spec2 = {
  designEntityId: "MVGhui9FfwAsWvJevD0kh",
  id: "Spec_001",
  version: "1",
  revision: "0",
  serviceType: "CFS",
  lifecycleStatus: "inDesign",
  "@type": "ServiceSpecification",
  audit: {
    projectId: "9oA1uhJgO2roi0mXtZgWL",
    projectName: "qefsd",
    createdBy: "unknownPrincipal",
    createdAt: "2025-07-22T10:03:54.751635226+02:00",
    changedBy: "unknownPrincipal",
    changedAt: "2025-07-22T10:03:54.751640107+02:00",
  },
  meta: {
    changeType: "new",
  },
  category: [
    {
      id: "test-category",
      version: "1",
      "@baseType": "Reference",
      "@type": "ServiceCategoryRef",
    },
  ],
  targetEntitySchema: {
    type: "object",
    properties: {
      firstName: {
        type: "string",
      },
      lastName: {
        type: "string",
      },
      dateOfBirth: {
        type: "string",
        format: "date",
      },
      personalAddress: {
        type: "object",
        properties: {
          streetAddress: {
            type: "string",
          },
          cityCode: {
            type: "string",
          },
          stateCode: {
            type: "string",
          },
          countryCode: {
            type: "string",
          },
        },
      },
    },
  },
  serviceSpecRelationship: [
    {
      id: "Spec_7645",
      associationSpec: {
        id: "Spec_7645",
        version: "1",
        "@baseType": "Reference",
        "@type": "ServiceSpecificationRef",
      },
      relationshipType: "parent",
      "@baseType": "Relationship",
      "@type": "ServiceSpecificationRelationship",
    },
  ],
  supportingServiceSpecification: [
    {
      id: "TEST_1",
      version: "1",
      "@baseType": "Reference",
      "@type": "ServiceSpecificationRef",
    },
  ],
  "@baseType": "Specification",
}
